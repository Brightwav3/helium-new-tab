import { decodeImage, validImageFile } from "./image-files.js";

// A navigation POST uses Google's own upload flow without cross-origin fetch permissions.
// No image is retained or sent until the user chooses a file or drops it on the page.
export function createImageSearch({ onError }) {
  const button = document.getElementById("image-search-button");
  const input = document.getElementById("image-file");
  const form = document.getElementById("image-upload-form");
  const overlay = document.getElementById("image-drop-zone");
  let depth = 0;
  let busy = false;

  function clearDrop() {
    depth = 0;
    overlay.hidden = true;
  }

  async function upload(files) {
    clearDrop();

    if (busy) {
      return;
    }

    if (files.length !== 1 || !validImageFile(files[0])) {
      input.value = "";
      onError("imageSearchInvalid");

      return;
    }

    busy = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    try {
      await decodeImage(files[0]);
      const transfer = new DataTransfer();
      transfer.items.add(files[0]);
      input.files = transfer.files;
      form.requestSubmit();
    } catch {
      input.value = "";
      onError("imageSearchError");
    } finally {
      busy = false;
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => void upload([...input.files]));

  const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes("Files");

  document.addEventListener("dragenter", (event) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    depth += 1;
    overlay.hidden = false;
  });

  document.addEventListener("dragover", (event) => {
    if (hasFiles(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  });

  document.addEventListener("dragleave", (event) => {
    if (!hasFiles(event)) {
      return;
    }

    depth = Math.max(0, depth - 1);

    if (depth === 0 || !event.relatedTarget) {
      clearDrop();
    }
  });

  document.addEventListener("drop", (event) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    void upload([...event.dataTransfer.files]);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearDrop();
    }
  });
  window.addEventListener("pageshow", clearDrop);
}
