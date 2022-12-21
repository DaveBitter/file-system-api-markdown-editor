import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import "@toast-ui/editor/dist/theme/toastui-editor-dark.css";

const elements = {
  sidebar: document.querySelector("[data-sidebar]"),
  sidebarToggle: document.querySelector("[data-sidebar-toggle]"),
  openFolderButton: document.querySelector("[data-open-folder]"),
  fileRootList: document.querySelector("[data-file-root-list]"),
  saveButton: document.querySelector("[data-save-button]"),
  editor: document.querySelector("[data-editor]"),
};

const templates = {
  fileList: document.querySelector("[data-template-file-list]"),
  fileListItem: document.querySelector("[data-template-file-list-item]"),
  fileListDirectory: document.querySelector(
    "[data-template-file-list-directory]"
  ),
};

let currentWorkingFile;
let hasChanges = false;

const handleChange = async () => {
  const updatedContent = editor.getMarkdown();
  const file = await currentWorkingFile.getFile();
  const contents = await file.text();

  hasChanges = updatedContent !== contents;
  elements.saveButton.disabled = updatedContent === contents;
};

const editor = new Editor({
  el: document.querySelector("[data-editor]"),
  initialEditType: "markdown",
  previewStyle: window.innerWidth < 800 ? "horizontal" : "vertical",
  height: "100vh",
  events: {
    change: handleChange,
  },
});

editor.setPlaceholder("Open a file to edit");

const mediaQuery = window.matchMedia("(min-width: 50rem)");

elements.sidebar.dataset.isOpen = mediaQuery.matches ? "true" : "false";
editor.changePreviewStyle(mediaQuery.matches ? "vertical" : "tab");

mediaQuery.addEventListener("change", ({ matches }) => {
  elements.sidebar.dataset.isOpen = matches ? "true" : "false";
  editor.changePreviewStyle(matches ? "vertical" : "tab");
});

elements.sidebarToggle.addEventListener("click", () => {
  elements.sidebar.dataset.isOpen = !(
    elements.sidebar.dataset.isOpen === "true"
  );
});

const saveCurrentWorkingFile = async () => {
  const updatedContent = editor.getMarkdown();
  const file = await currentWorkingFile.getFile();
  const contents = await file.text();

  if (updatedContent === contents) {
    return;
  }

  const writable = await currentWorkingFile.createWritable();
  await writable.write(updatedContent);
  await writable.close();
  hasChanges = false;
  elements.saveButton.disabled = true;
};

elements.saveButton.addEventListener("click", saveCurrentWorkingFile);

elements.openFolderButton.addEventListener("click", async () => {
  const dirHandle = await window.showDirectoryPicker();

  elements.editor.dataset.isActive = "true";
  elements.fileRootList.innerHTML = null;

  const entries = [];
  for await (const entry of dirHandle.values()) {
    entries.push(entry);
  }

  const openFile = async (entry) => {
    hasChanges = false;
    elements.saveButton.disabled = true;
    currentWorkingFile = entry;
    const file = await entry.getFile();
    const contents = await file.text();

    editor.setMarkdown(contents);
  };

  entries
    .sort((a, b) => b.name - a.name)
    .forEach((entry) => {
      const { name, kind } = entry;

      switch (kind) {
        case "file":
          const fileListItemClone =
            templates.fileListItem.content.cloneNode(true);
          const fileListItemButton = fileListItemClone.querySelector(
            "[data-file-list-item-button]"
          );

          fileListItemButton.addEventListener("click", () => {
            if (hasChanges) {
              if (
                window.confirm(
                  "You have unsafed work. Are you sure you want to discard this?"
                )
              ) {
                openFile(entry);
              }
            } else {
              openFile(entry);
            }
          });

          fileListItemButton.innerText = name;
          elements.fileRootList.appendChild(fileListItemClone);
          break;

        case "directory":
          const fileListDirectoryClone =
            templates.fileListDirectory.content.cloneNode(true);

          const fileListDirectory = fileListDirectoryClone.querySelector(
            "[data-file-list-item-directory]"
          );

          fileListDirectory.innerText = name;
          elements.fileRootList.appendChild(fileListDirectoryClone);
        default:
          break;
      }
    });
});
