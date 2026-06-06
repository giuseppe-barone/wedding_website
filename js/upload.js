// ————————————————————————————————————————
// MODIFICA QUESTA URL con quella del tuo Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxPbhC5jeR6Ox9jJdPIvKWDDeu874aPgsZcwubgeCSbBBcNocniiGFGFZkleySb-JOt3A/exec";
// ————————————————————————————————————————

const MAX_PREVIEW    = 8;   // Numero massimo di anteprime mostrate
const CONCURRENCY    = 6;   // Worker paralleli attivi contemporaneamente
const MAX_RETRIES    = 2;   // Tentativi extra in caso di errore di rete
const RETRY_DELAY_MS = 800; // Attesa (ms) tra un tentativo e il successivo

// Tipi e estensioni consentiti (immagini e video comuni)
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_EXTENSIONS    = new Set([
    "jpg","jpeg","png","gif","webp","heic","heif","bmp","tiff","tif","avif",
    "mp4","mov","avi","mkv","webm","m4v","3gp","wmv"
]);

const fileInput     = document.getElementById("fileInput");
const dropArea      = document.getElementById("dropArea");
const previewGrid   = document.getElementById("previewGrid");
const uploadBtn     = document.getElementById("uploadBtn");
const progressWrap  = document.getElementById("progressWrap");
const progressFill  = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const msg           = document.getElementById("msg");

let selectedFiles = [];

// ── Banner "tieni aperto il browser" ─────────────────────────────────────────
const banner = document.createElement("div");
banner.id = "stay-open-banner";
banner.innerHTML = "📵 Tieni il browser aperto fino al termine del caricamento.";
banner.style.cssText = [
    "display:none",
    "position:fixed",
    "bottom:0",
    "left:0",
    "right:0",
    "z-index:9999",
    "background:#d97706",
    "color:#fff",
    "text-align:center",
    "padding:14px 16px",
    "font-size:15px",
    "font-weight:500",
    "letter-spacing:0.01em",
    "box-shadow:0 -2px 12px rgba(0,0,0,0.18)",
].join(";");
document.body.appendChild(banner);

function showBanner() { banner.style.display = "block"; }
function hideBanner() { banner.style.display = "none";  }

// Avvisa anche se l'utente prova a chiudere/ricaricare la scheda durante l'upload
let uploading = false;
window.addEventListener("beforeunload", e => {
    if (!uploading) return;
    e.preventDefault();
    e.returnValue = "Il caricamento è in corso. Sei sicuro di voler uscire?";
});

// ── Drag & drop ───────────────────────────────────────────────────────────────
dropArea.addEventListener("dragover",  e => { e.preventDefault(); dropArea.classList.add("dragover"); });
dropArea.addEventListener("dragleave", ()  => dropArea.classList.remove("dragover"));
dropArea.addEventListener("drop", e => {
    e.preventDefault();
    dropArea.classList.remove("dragover");
    handleFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener("change", () => handleFiles([...fileInput.files]));

function handleFiles(files) {
    // Valida ogni file: mimeType deve essere immagine/video E estensione consentita
    const valid   = [];
    const invalid = [];

    for (const f of files) {
        const ext        = f.name.split(".").pop().toLowerCase();
        const mimeOk     = ALLOWED_MIME_PREFIXES.some(p => f.type.startsWith(p));
        const extOk      = ALLOWED_EXTENSIONS.has(ext);

        if (mimeOk && extOk) valid.push(f);
        else                  invalid.push(f.name);
    }

    if (invalid.length) {
        const lista = invalid.length <= 3
            ? invalid.join(", ")
            : invalid.slice(0, 3).join(", ") + ` e altri ${invalid.length - 3}`;
        msg.style.display = "block";
        msg.className     = "msg error";
        msg.textContent   = `File non consentiti: ${lista}. Sono accettati solo immagini e video.`;
    } else {
        msg.style.display = "none";
    }

    selectedFiles = valid;
    uploadBtn.disabled = valid.length === 0;
    previewGrid.innerHTML = "";
    const imageFiles = valid.filter(f => f.type.startsWith("image/"));
    const toShow     = imageFiles.slice(0, MAX_PREVIEW);
    const extra      = valid.length - toShow.length;

    toShow.forEach(f => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(f);
        previewGrid.appendChild(img);
    });

    if (extra > 0) {
        const more = document.createElement("div");
        more.className = "preview-more";
        more.innerHTML = `<span>+${extra}</span><span>altri file</span>`;
        previewGrid.appendChild(more);
    }
}

// ── Upload ────────────────────────────────────────────────────────────────────
uploadBtn.addEventListener("click", async () => {
    const ospite = document.getElementById("ospite").value.trim() || "Ospite";
    if (!selectedFiles.length) return;

    uploading = true;
    showBanner();

    uploadBtn.disabled = true;
    progressWrap.style.display = "block";
    msg.style.display = "none";

    const total = selectedFiles.length;
    let completed = 0, ok = 0, fail = 0;

    function updateProgress() {
        const pct = Math.round((completed / total) * 100);
        progressFill.style.width = pct + "%";
        progressLabel.textContent = `Caricamento ${completed} di ${total}...`;
    }

    // 1. Init: trova o crea la cartella ospite, ottieni il suo ID ─────────────
    progressLabel.textContent = "Preparazione cartella...";
    let folderId;
    try {
        const initRes  = await fetch(SCRIPT_URL + "?action=init", {
            method: "POST",
            body: JSON.stringify({ action: "init", ospite }),
            redirect: "follow"
        });
        const initJson = await initRes.json();
        if (!initJson.success) throw new Error(initJson.error || "Init fallito");
        folderId = initJson.folderId;
    } catch (err) {
        uploading = false;
        hideBanner();
        msg.style.display = "block";
        msg.className = "msg error";
        msg.textContent = "Errore nella preparazione della cartella. Riprova.";
        uploadBtn.disabled = false;
        return;
    }

    updateProgress();

    // 2. Pre-converti tutti i file in base64 in parallelo ─────────────────────
    const encoded = await Promise.all(
        [...selectedFiles].map(async f => ({ file: f, base64: await toBase64(f) }))
    );

    // 3. Coda con N worker concorrenti ─────────────────────────────────────────
    const queue = [...encoded];

    async function worker() {
        while (queue.length) {
            const { file, base64 } = queue.shift();
            const success = await uploadWithRetry(file, base64, folderId);
            success ? ok++ : fail++;
            completed++;
            updateProgress();
        }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

    // 4. Fine ──────────────────────────────────────────────────────────────────
    uploading = false;
    hideBanner();

    progressFill.style.width = "100%";
    progressLabel.textContent = "Completato!";

    msg.style.display = "block";
    if (fail === 0) {
        msg.className = "msg success";
        msg.textContent = `Perfetto, ${ok} foto caricate con successo. Grazie!`;
    } else {
        msg.className = "msg error";
        msg.textContent = `${ok} foto caricate, ${fail} non riuscite. Riprova.`;
    }

    uploadBtn.disabled = false;
    selectedFiles = [];
    previewGrid.innerHTML = "";
    fileInput.value = "";
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadWithRetry(file, base64, folderId) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(SCRIPT_URL + "?action=upload", {
                method: "POST",
                body: JSON.stringify({
                    action: "upload",
                    fileName: file.name,
                    mimeType: file.type,
                    base64,
                    folderId
                }),
                redirect: "follow"
            });
            const json = await res.json();
            if (json.success) return true;
            return false;
        } catch {
            if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
    }
    return false;
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));