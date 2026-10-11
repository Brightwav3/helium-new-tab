import { decodeImage, validImageFile } from "./image-files.js";

const DATABASE = "helium-tab-images";
const STORE = "images";
const KEY = "background";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedBackground(operation, value) {
  const database = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        STORE,
        operation === "get" ? "readonly" : "readwrite",
      );
      const store = transaction.objectStore(STORE);
      const request = operation === "put" ? store.put(value, KEY) : store[operation](KEY);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

// Large files stay out of preference/sync quotas. Blob URLs never leave this device.
export function createCustomBackground({ onError }) {
  let currentUrl;
  let revision = 0;
  let controls;
  const channel = new BroadcastChannel(DATABASE);

  function paint(value) {
    const previousUrl = currentUrl;
    currentUrl = value ? URL.createObjectURL(value.file) : undefined;
    const root = document.documentElement;

    if (currentUrl) {
      root.style.setProperty("--custom-background", `url("${currentUrl}")`);
      root.dataset.customBackground = "true";
    } else {
      root.style.removeProperty("--custom-background");
      delete root.dataset.customBackground;
    }

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    if (controls) {
      controls.name.textContent = value?.name ?? "";
      controls.remove.hidden = !value;
    }
  }

  async function load() {
    const request = ++revision;

    try {
      const value = await storedBackground("get");

      if (request === revision) {
        paint(value);
      }
    } catch {
      onError("backgroundError");
    }
  }

  channel.addEventListener("message", () => void load());
  void load();

  function bind(dialog) {
    controls = {
      input: dialog.querySelector("#background-file"),
      choose: dialog.querySelector("#choose-background"),
      remove: dialog.querySelector("#remove-background"),
      name: dialog.querySelector("#background-name"),
    };
    controls.choose.addEventListener("click", () => controls.input.click());

    async function save(file) {
      if (file && !validImageFile(file)) {
        onError("imageSearchInvalid");

        return;
      }

      controls.choose.disabled = true;
      controls.remove.disabled = true;
      revision += 1;

      try {
        if (file) {
          await decodeImage(file);
        }

        const value = file ? { file, name: file.name } : undefined;
        await storedBackground(file ? "put" : "delete", value);
        paint(value);
        channel.postMessage("changed");
      } catch {
        onError("backgroundError");
      } finally {
        controls.input.value = "";
        controls.choose.disabled = false;
        controls.remove.disabled = false;
      }
    }

    controls.input.addEventListener("change", () => {
      const file = controls.input.files[0];

      if (file) {
        void save(file);
      }
    });
    controls.remove.addEventListener("click", () => void save());
    void load();
  }

  return { bind };
}
