/*** External deps ***/
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import "@toast-ui/editor/dist/theme/toastui-editor-dark.css";

import toastr from "toastr";

/*** Internal deps ***/
import { registerServiceWorker } from "./registerServiceWorker";

/*** Cached selectors to be used ***/
const elements = {
  sidebar: document.querySelector("[data-sidebar]"),
  sidebarToggle: document.querySelector("[data-sidebar-toggle]"),
  openFolderButton: document.querySelector("[data-open-folder]"),
  fileRootList: document.querySelector("[data-file-root-list]"),
  saveButton: document.querySelector("[data-save-button]"),
  editor: document.querySelector("[data-editor]"),
  unsupportedNotice: document.querySelector("[data-unsupported-notice]"),
};

const templates = {
  fileList: document.querySelector("[data-template-file-list]"),
  fileListRootDirectory: document.querySelector(
    "[data-template-file-list-root-directory]"
  ),
  fileListItem: document.querySelector("[data-template-file-list-item]"),
  fileListDirectory: document.querySelector(
    "[data-template-file-list-directory]"
  ),
};

/*** Contstants ***/
const CONSTANTS = {
  MATCH_MEDIA_WIDTH_QUERY: window.matchMedia("(min-width: 50rem)"),
  MATCH_MEDIA_COLOR_SCHEME_QUERY: window.matchMedia(
    "(prefers-color-scheme: dark)"
  ),
};

let editor;

/*** Application state ***/
const state = {
  rootDirhandle: null,
  activeWorkingHandle: null,
  activeWorkingSidebarNode: null,
  hasChanges: false,
};

/*** Helpers ***/
const handleFileSelection = (entry, sidebarNode) => {
  if (state.hasChanges) {
    if (
      window.confirm(
        "You have unsafed work. Are you sure you want to discard this?"
      )
    ) {
      openFile(entry, sidebarNode);
    }
  } else {
    openFile(entry, sidebarNode);
  }
};

const renderSidebarItemForRootDirectoryEntry = async (entry) => {
  const fileListRootDirectoryClone =
    templates.fileListRootDirectory.content.cloneNode(true);
  const fileListRootDirectory = fileListRootDirectoryClone.querySelector(
    "[data-file-list-root-directory]"
  );

  const fileListRootDirectoryName = fileListRootDirectory.querySelector(
    "[data-file-list-root-name]"
  );
  fileListRootDirectoryName.innerText = entry.name;
  elements.fileRootList.appendChild(fileListRootDirectory);

  const fileListRootDirectoryCreateButton = fileListRootDirectory.querySelector(
    "[data-file-list-root-directory-create-button]"
  );

  fileListRootDirectoryCreateButton.addEventListener("click", () =>
    createEntry(entry)
  );
};

const renderSidebarItemForDirectoryEntry = async (root, item) => {
  const { entry, entries } = item;

  const fileListDirectoryClone =
    templates.fileListDirectory.content.cloneNode(true);
  const fileListClone = templates.fileList.content.cloneNode(true);

  const fileListItem = fileListDirectoryClone.querySelector(
    "[data-file-list-item]"
  );
  const fileListDirectory = fileListItem.querySelector(
    "[data-file-list-item-directory]"
  );

  const fileList = fileListClone.querySelector("[data-file-list]");

  fileListDirectory.innerText = entry.name;
  root.appendChild(fileListItem);
  fileListItem.appendChild(fileListClone);

  const fileListDirectoryRemoveButton = fileListItem.querySelector(
    "[data-file-list-item-directory-remove-button]"
  );
  fileListDirectoryRemoveButton.addEventListener("click", () =>
    removeEntry(entry, fileListDirectoryRemoveButton)
  );

  const fileListItemCreateButton = fileListItem.querySelector(
    "[data-file-list-item-directory-create-button]"
  );
  fileListItemCreateButton.addEventListener("click", () => createEntry(entry));

  await renderSidebarItemsFromEntries(entries, fileList);
};

const renderSidebarItemForFileEntry = (root, item) => {
  const { entry } = item;

  const fileListItemClone = templates.fileListItem.content.cloneNode(true);
  const fileListItem = fileListItemClone.querySelector("[data-file-list-item]");
  const fileListItemButton = fileListItem.querySelector(
    "[data-file-list-item-button]"
  );
  const fileListItemRemoveButton = fileListItem.querySelector(
    "[data-file-list-item-remove-button]"
  );

  fileListItemButton.addEventListener("click", () =>
    handleFileSelection(entry, fileListItemButton)
  );

  fileListItemRemoveButton.addEventListener("click", () =>
    removeEntry(entry, fileListItemButton)
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

const renderSidebar = async () => {
  const entries = await getEntriesRecursivelyFromHandles(
    state.rootDirhandle.values()
  );

  elements.fileRootList.innerHTML = null;
  renderSidebarItemForRootDirectoryEntry(state.rootDirhandle);
  renderSidebarItemsFromEntries(entries, elements.fileRootList);
};

const openFolder = async () => {
  state.rootDirhandle = await window.showDirectoryPicker({
    types: [
      {
        description: "MarkDown",
        accept: {
          "text/markdown": [".md"],
        },
      },
    ],
  });

  renderSidebar();
};

const onMediaQueryWidthChange = ({ matches }) => {
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
  elements.saveButton.addEventListener("click", saveActiveWorkingHandle);
  elements.openFolderButton.addEventListener("click", openFolder);
  CONSTANTS.MATCH_MEDIA_WIDTH_QUERY.addEventListener(
    "change",
    onMediaQueryWidthChange
  );
};

const initializeToastr = () => {
  toastr.options = {
    closeButton: true,
    debug: false,
    newestOnTop: false,
    progressBar: true,
    positionClass: "toast-bottom-right",
    preventDuplicates: false,
    onclick: null,
    showDuration: "300",
    hideDuration: "1000",
    timeOut: "5000",
    extendedTimeOut: "1000",
    showEasing: "swing",
    hideEasing: "linear",
    showMethod: "fadeIn",
    hideMethod: "fadeOut",
  };
};

const initializeEditor = () => {
  editor = new Editor({
    el: document.querySelector("[data-editor]"),
    initialEditType: "markdown",
    previewStyle: CONSTANTS.MATCH_MEDIA_WIDTH_QUERY.matches
      ? "horizontal"
      : "vertical",
    height: "100vh",
    theme: CONSTANTS.MATCH_MEDIA_COLOR_SCHEME_QUERY.matches ? "dark" : "light",
    events: {
      change: handleChange,
    },
  });

  editor.setPlaceholder("Open a file to edit");

  elements.editor.dataset.isActive = "true";
  editor.setMarkdown();
  editor.changePreviewStyle(
    CONSTANTS.MATCH_MEDIA_WIDTH_QUERY.matches ? "vertical" : "tab"
  );
};

const initializeSidebar = () => {
  elements.sidebar.dataset.isOpen = CONSTANTS.MATCH_MEDIA_WIDTH_QUERY.matches
    ? "true"
    : "false";

  elements.fileRootList.innerHTML = null;
};

const showUnsupportedNotice = () => {
  elements.unsupportedNotice.dataset.isVisible = "true";
};

const initializeApplication = () => {
  const isSupported = "showDirectoryPicker" in window;

  if (!isSupported) {
    showUnsupportedNotice();
    return;
  }

  initializeSidebar();
  initializeEditor();
  initializeToastr();
  initializeEventListeners();
};

const setIsChangedState = (isChanged) => {
  state.hasChanges = isChanged;
  elements.saveButton.disabled = !isChanged;
};

const saveFileForHandle = async (handle) => {
  try {
    const updatedContent = editor.getMarkdown();

    const writable = await handle.createWritable();
    await writable.write(updatedContent);
    await writable.close();

    toastr.success(`Saved ${handle.name}`);
  } catch (error) {
    toastr.error(`Something went wrong saving ${handle.name}`);
  }

  setIsChangedState(false);
};

const getFileContentsForHandle = async (handle) => {
  const file = await handle.getFile();
  const contents = await file.text();

  return contents;
};

const handleChange = async () => {
  /* ToastUI triggers the change event when the editor is cleared which can be ignored */
  if (!state.activeWorkingHandle) {
    return;
  }

  const updatedContent = editor.getMarkdown();
  const contents = await getFileContentsForHandle(state.activeWorkingHandle);

  setIsChangedState(updatedContent !== contents);
};

const saveActiveWorkingHandle = async () => {
  const updatedContent = editor.getMarkdown();

  const contents = await getFileContentsForHandle(state.activeWorkingHandle);

  /* No need to save (and get permission) if there are no changes */
  if (updatedContent === contents) {
    return;
  }

  saveFileForHandle(state.activeWorkingHandle);
};

const getEntriesRecursivelyFromHandles = async (handles) => {
  const entries = [];

  for await (const entry of handles) {
    const { kind } = entry;

    switch (kind) {
      case "file":
        entries.push({
          kind,
          entry,
        });
        break;

      case "directory":
        const directoryHandles = await entry.values();

        entries.push({
          kind,
          entry,
          entries: await getEntriesRecursivelyFromHandles(
            directoryHandles
          ).catch(console.error),
        });
        break;
    }
  }

  return entries.sort((a, b) => a.kind.localeCompare(b.kind));
};

const createEntry = async (entry) => {
  try {
    await self.showSaveFilePicker({
      startIn: entry,
      suggestedName: "untitled.md",
      types: [
        {
          description: "Markdown files",
          accept: {
            "text/md": [".md"],
          },
        },
      ],
    });

    toastr.success(`Created ${entry.name}`);
  } catch (error) {
    toastr.error(`Something went wrong creating ${entry.name}`);
  }

  renderSidebar();
};

const removeEntry = async (entry, sidebarNode) => {
  const { kind, name } = entry;

  if (window.confirm(`Are you sure you want to delete this ${kind}?`)) {
    try {
      await entry.remove();
      toastr.success(`Removed ${name}`);
    } catch (error) {
      toastr.error(`Something went wrong removing ${name}`);
    }

    sidebarNode.parentNode.removeChild(sidebarNode);

    renderSidebar();
  }
};

const openFile = async (entry, sidebarNode) => {
  setIsChangedState(false);

  if (state.activeSidebarNode) {
    state.activeSidebarNode.dataset.isActive = "false";
  }

  state.activeWorkingHandle = entry;
  state.activeSidebarNode = sidebarNode;

  state.activeSidebarNode.dataset.isActive = "true";

  try {
    const contents = await getFileContentsForHandle(entry);

    editor.setMarkdown(contents);
  } catch (error) {
    toastr.error(`Something went wrong opening ${entry.name}`);
  }
};

initializeApplication();
registerServiceWorker();
