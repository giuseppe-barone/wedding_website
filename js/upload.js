// ————————————————————————————————————————
// MODIFICA QUESTA URL con quella del tuo Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyD2QY3bEt2ONHgEfXa4aVXiwqix8HhktNdPPHYYy96qNMh8b9yxCgICPIpySgBLFmKuw/exec";
// ————————————————————————————————————————

const MAX_PREVIEW  = 8;   // Numero massimo di anteprime mostrate
const BATCH_SIZE   = 4;   // Foto caricate in parallelo contemporaneamente

const fileInput     = document.getElementById("fileInput");
const dropArea      = document.getElementById("dropArea");
const previewGrid   = document.getElementById("previewGrid");
const uploadBtn     = document.getElementById("uploadBtn");
const progressWrap  = document.getElementById("progressWrap");
const progressFill  = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const msg           = document.getElementById("msg");

let selectedFiles = [];

// Drag & drop
dropArea.addEventListener("dragover", e => { e.preventDefault(); dropArea.classList.add("dragover"); });
dropArea.addEventListener("dragleave", () => dropArea.classList.remove("dragover"));
dropArea.addEventListener("drop", e => {
    e.preventDefault();
    dropArea.classList.remove("dragover");
    handleFiles([...e.dataTransfer.files]);
});

fileInput.addEventListener("change", () => handleFiles([...fileInput.files]));

function handleFiles(files) {
    selectedFiles = files;
    previewGrid.innerHTML = "";

    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    const toShow     = imageFiles.slice(0, MAX_PREVIEW);
    const extra      = files.length - toShow.length;

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

    uploadBtn.disabled = files.length === 0;
}

uploadBtn.addEventListener("click", async () => {
    const ospite = document.getElementById("ospite").value.trim() || "Ospite";
    if (!selectedFiles.length) return;

    uploadBtn.disabled = true;
    progressWrap.style.display = "block";
    msg.style.display = "none";

    let completed = 0;
    let ok = 0;
    let fail = 0;
    const total = selectedFiles.length;

    function updateProgress() {
        const pct = Math.round((completed / total) * 100);
        progressFill.style.width = pct + "%";
        progressLabel.textContent = `Caricamento ${completed} di ${total}...`;
    }

    async function uploadFile(file) {
        try {
            const base64 = await toBase64(file);
            const res = await fetch(SCRIPT_URL, {
                method: "POST",
                body: JSON.stringify({
                    fileName: file.name,
                    mimeType: file.type,
                    base64: base64,
                    ospite: ospite
                })
            });
            const json = await res.json();
            if (json.success) ok++; else fail++;
        } catch(e) {
            fail++;
        } finally {
            completed++;
            updateProgress();
        }
    }

    // Caricamento a batch paralleli
    const files = [...selectedFiles];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(uploadFile));
    }

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

function toBase64(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
}