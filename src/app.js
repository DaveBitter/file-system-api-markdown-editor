/*** External deps ***/
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import "@toast-ui/editor/dist/theme/toastui-editor-dark.css";

/*** Cached selectors to be used ***/
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

/*** Contstants ***/
const CONSTANTS = {
  MATCH_MEDIA_QUERY: window.matchMedia("(min-width: 50rem)"),
};

let editor;

/*** Application state ***/
const state = {
  currentWorkingHandle: null,
  hasChanges: false,
};

/*** Helpers ***/
const handleFileSelection = (entry) => {
  if (state.hasChanges) {
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
};

const renderSidebarItemForDirectoryEntry = async (root, item) => {
  const { entry, entries } = item;

  const fileListDirectoryClone =
    templates.fileListDirectory.content.cloneNode(true);
  const fileListClone = templates.fileList.content.cloneNode(true);

  const fileListItem = fileListDirectoryClone.querySelector(
    "[data-file-list-item]"
  );
  const fileListDirectory = fileListDirectoryClone.querySelector(
    "[data-file-list-item-directory]"
  );
  const fileList = fileListClone.querySelector("[data-file-list]");

  fileListDirectory.innerText = entry.name;
  root.appendChild(fileListDirectoryClone);
  fileListItem.appendChild(fileListClone);

  await renderSidebarItemsFromEntries(entries, fileList);
};

const renderSidebarItemForFileEntry = (root, item) => {
  const { entry } = item;

  const fileListItemClone = templates.fileListItem.content.cloneNode(true);
  const fileListItemButton = fileListItemClone.querySelector(
    "[data-file-list-item-button]"
  );

  fileListItemButton.addEventListener("click", () =>
    handleFileSelection(entry)
  );

  fileListItemButton.innerText = entry.name;
  root.appendChild(fileListItemClone);
};

const renderSidebarItemsFromEntries = async (entries, root) => {
  for (const item of entries) {
    switch (item.kind) {
      case "file":
        renderSidebarItemForFileEntry(root, item);
        break;

      case "directory":
        await renderSidebarItemForDirectoryEntry(root, item);
        break;
      default:
        break;
    }
  }
};

const openFolder = async () => {
  const dirHandle = await window.showDirectoryPicker({
    types: [
      {
        description: "Markdown",
        accept: {
          "text/markdown": [".md"],
        },
      },
    ],
  });

  const entries = await getEntriesRecursivelyFromSelectedDirectory(dirHandle);

  elements.fileRootList.innerHTML = null;
  renderSidebarItemsFromEntries(entries, elements.fileRootList);
};

const onMediaQueryChange = ({ matches }) => {
  elements.sidebar.dataset.isOpen = matches ? "true" : "false";
  editor.changePreviewStyle(matches ? "vertical" : "tab");
};

const toggleSidebar = () => {
  elements.sidebar.dataset.isOpen = !(
    elements.sidebar.dataset.isOpen === "true"
  );
};

const initializeEventListeners = () => {
  elements.sidebarToggle.addEventListener("click", toggleSidebar);
  elements.saveButton.addEventListener("click", saveCurrentWorkingHandle);
  elements.openFolderButton.addEventListener("click", openFolder);
};

const initializeEditor = () => {
  editor = new Editor({
    el: document.querySelector("[data-editor]"),
    initialEditType: "markdown",
    previewStyle: window.innerWidth < 800 ? "horizontal" : "vertical",
    height: "100vh",
    events: {
      change: handleChange,
    },
  });

  editor.setPlaceholder("Open a file to edit");

  elements.editor.dataset.isActive = "true";
  editor.setMarkdown();
  editor.changePreviewStyle(
    CONSTANTS.MATCH_MEDIA_QUERY.matches ? "vertical" : "tab"
  );
};

const initializeSidebar = () => {
  elements.sidebar.dataset.isOpen = CONSTANTS.MATCH_MEDIA_QUERY.matches
    ? "true"
    : "false";

  CONSTANTS.MATCH_MEDIA_QUERY.addEventListener("change", onMediaQueryChange);

  elements.fileRootList.innerHTML = null;
};

const initializeApplication = () => {
  initializeSidebar();
  initializeEditor();
  initializeEventListeners();
};

const setIsChangedState = (isChanged) => {
  state.hasChanges = isChanged;
  elements.saveButton.disabled = !isChanged;
};

const saveFileForHandle = async (handle) => {
  const updatedContent = editor.getMarkdown();

  const writable = await handle.createWritable();
  await writable.write(updatedContent);
  await writable.close();

  setIsChangedState(false);
};

const getFileContentsForHandle = async (handle) => {
  const file = await handle.getFile();
  const contents = await file.text();

  return contents;
};

const handleChange = async () => {
  /* ToastUI triggers the change event when the editor is cleared which can be ignored */
  if (!state.currentWorkingHandle) {
    return;
  }

  const updatedContent = editor.getMarkdown();
  const contents = await getFileContentsForHandle(state.currentWorkingHandle);

  setIsChangedState(updatedContent !== contents);
};

const saveCurrentWorkingHandle = async () => {
  const updatedContent = editor.getMarkdown();

  const contents = await getFileContentsForHandle(state.currentWorkingHandle);

  /* No need to save (and get permission) if there are no changes */
  if (updatedContent === contents) {
    return;
  }

  saveFileForHandle(state.currentWorkingHandle);
};

const getEntriesRecursivelyFromSelectedDirectory = async (directoryHandle) => {
  const entries = [];

  for await (const entry of directoryHandle.values()) {
    const { kind } = entry;

    switch (kind) {
      case "file":
        entries.push({
          kind,
          entry,
        });
        break;

      case "directory":
        const handles = await directoryHandle.getDirectoryHandle(entry.name);

        entries.push({
          kind,
          entry,
          entries: await getEntriesRecursivelyFromSelectedDirectory(
            handles
          ).catch(console.error),
        });
        break;
    }
  }

  return entries.sort((a, b) => a.kind.localeCompare(b.kind));
};

const openFile = async (entry) => {
  setIsChangedState(false);
  state.currentWorkingHandle = entry;

  const contents = await await getFileContentsForHandle(entry);
  editor.setMarkdown(contents);
};

initializeApplication();
