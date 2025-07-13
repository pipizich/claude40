/**
 * ============================================================================
 * ART GALLERY - UI COMPONENTS & INTERACTIONS (gallery-ui.js)
 * ============================================================================
 * 
 * UI component classes, form handling, and user interactions
 * - Modal Management
 * - File Upload & Form Handling
 * - Search & Sort functionality
 * - Event listeners and UI behaviors
 * 
 * Dependencies: gallery-core.js (must be loaded first)
 * 
 * ============================================================================
 */

/* ============================================================================
   DEPENDENCY CHECK & INITIALIZATION
   ============================================================================ */

// Wait for core to be ready
function waitForCore() {
  return new Promise((resolve) => {
    if (window.galleryCore && window.galleryCore.ready) {
      resolve(window.galleryCore);
    } else {
      window.addEventListener('galleryCoreReady', (e) => {
        resolve(e.detail);
      }, { once: true });
    }
  });
}

/* ============================================================================
   1. UI COMPONENT CLASSES
   ============================================================================ */

/**
 * Modal Manager
 * Handles all modal dialogs in the application
 */
/**
 * Modal Manager - FIXED VERSION
 * Thêm logic ẩn/hiện edit-mode-button khi mở/đóng modal
 */
class ModalManager {
    constructor() {
        this.modals = {
            add: document.getElementById('add-artwork-modal'),
            edit: document.getElementById('edit-artwork-modal'),
            view: document.getElementById('view-description-modal'),
            delete: document.getElementById('delete-confirm-modal')
        };
        
        this.currentEditId = null;
        this.artworkToDelete = null;
        
        // ✅ NEW: Track floating buttons that should be hidden during modals
        this.floatingButtons = [];
        this.originalDisplayStates = new Map();
        
        this.init();
    }

    init() {
        // ✅ NEW: Find floating buttons to hide during modals
        this.findFloatingButtons();
        
        const addBtn = document.getElementById('add-artwork-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddModal());
        }

        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                this.closeModal(modal);
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        const confirmBtn = document.getElementById('confirm-delete');
        const cancelBtn = document.getElementById('cancel-delete');
        
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.handleDelete());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal(this.modals.delete));

        // Listen for core events
        window.addEventListener('showDescription', (e) => {
            this.openViewModal(e.detail);
        });
    }

    // ✅ NEW: Find floating buttons that should be hidden during modals
    findFloatingButtons() {
        this.floatingButtons = [
            document.querySelector('.edit-mode-button'),
            document.querySelector('.theme-toggle-container'),
            document.querySelector('.metadata-viewer-toggle'),
            document.querySelector('.fab')
        ].filter(Boolean);
        
        console.log(`🔍 Found ${this.floatingButtons.length} floating buttons to manage`);
    }

    // ✅ NEW: Hide floating buttons when modal opens
    hideFloatingButtons() {
        this.floatingButtons.forEach(button => {
            if (button && !this.originalDisplayStates.has(button)) {
                // Store original display state
                const computedDisplay = window.getComputedStyle(button).display;
                const inlineDisplay = button.style.display;
                this.originalDisplayStates.set(button, inlineDisplay || computedDisplay || '');
                
                // Hide button
                button.style.display = 'none';
            }
        });
        console.log('🙈 Floating buttons hidden for modal');
    }

    // ✅ NEW: Show floating buttons when modal closes
    showFloatingButtons() {
        this.floatingButtons.forEach(button => {
            if (button && this.originalDisplayStates.has(button)) {
                // Restore original display state
                const originalDisplay = this.originalDisplayStates.get(button);
                button.style.display = originalDisplay === 'none' ? '' : originalDisplay;
                this.originalDisplayStates.delete(button);
            }
        });
        console.log('👀 Floating buttons restored after modal close');
    }

    openAddModal() {
        // ✅ FIXED: Hide floating buttons before opening modal
        this.hideFloatingButtons();
        
        window.galleryCore.AnimationManager.animateModalOpen(this.modals.add);
        if (window.toast) window.toast.info('Ready to add new artwork');
    }

    openEditModal(data) {
        // ✅ FIXED: Hide floating buttons before opening modal
        this.hideFloatingButtons();
        
        this.currentEditId = data.id;
        
        const titleInput = document.getElementById('edit-title');
        const descInput = document.getElementById('edit-description');
        
        if (titleInput) titleInput.value = data.title || '';
        if (descInput) descInput.value = data.description || '';
        
        window.galleryCore.AnimationManager.animateModalOpen(this.modals.edit);
        if (window.toast) window.toast.info(`Editing: "${data.title || 'Untitled'}"`);
    }

    openDeleteModal(data) {
        // ✅ FIXED: Hide floating buttons before opening modal
        this.hideFloatingButtons();
        
        this.artworkToDelete = data.id;
        window.galleryCore.AnimationManager.animateModalOpen(this.modals.delete);
        if (window.toast) window.toast.warning(`Confirm deletion of "${data.title || 'this artwork'}"`);
    }

    openViewModal(data) {
        // ✅ FIXED: Hide floating buttons before opening modal
        this.hideFloatingButtons();
        
        const titleEl = document.getElementById('view-title');
        const descEl = document.getElementById('view-description-text');
        
        if (titleEl) titleEl.textContent = data.title || 'Untitled';
        if (descEl) descEl.textContent = data.description || 'No description available.';
        
        window.galleryCore.AnimationManager.animateModalOpen(this.modals.view);
        if (window.toast) window.toast.info('Description loaded');
    }

    async closeModal(modal) {
        if (!modal) return;
        
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            const previewContainer = form.querySelector('[id*="preview-container"]');
            if (previewContainer) previewContainer.innerHTML = '';
        }

        if (modal === this.modals.edit) this.currentEditId = null;
        if (modal === this.modals.delete) this.artworkToDelete = null;

        await window.galleryCore.AnimationManager.animateModalClose(modal);
        
        // ✅ FIXED: Restore floating buttons after modal closes
        this.showFloatingButtons();
        
        if (window.toast) window.toast.info('Modal closed');
    }

    closeAllModals() {
        Object.values(this.modals).forEach(modal => {
            if (modal && modal.style.display === 'block') {
                this.closeModal(modal);
            }
        });
    }

    // ✅ NEW: Emergency cleanup method
    forceRestoreFloatingButtons() {
        this.originalDisplayStates.forEach((originalDisplay, button) => {
            if (button) {
                button.style.display = originalDisplay === 'none' ? '' : originalDisplay;
            }
        });
        this.originalDisplayStates.clear();
        console.log('🚨 Emergency restore of floating buttons completed');
    }

    // ... rest of the methods remain the same
    async handleDelete() {
        if (!this.artworkToDelete) return;

        const deleteBtn = document.getElementById('confirm-delete');
        window.galleryCore.LoadingManager.setButtonLoading(deleteBtn, true);
        
        try {
            const result = await window.galleryCore.enhancedFetch(`/delete/${this.artworkToDelete}`, { 
                method: 'POST'
            });
            
            if (result.success) {
                const artworkEl = document.querySelector(`[data-id="${this.artworkToDelete}"]`);
                if (artworkEl) {
                    await window.galleryCore.AnimationManager.animateRemoveArtwork(artworkEl);
                    artworkEl.remove();
                    
                    if (window.artGalleryApp && window.artGalleryApp.updateImageCounter) {
                        window.artGalleryApp.updateImageCounter();
                    }
                }
                
                if (window.toast) window.toast.success(result.message);
                await this.closeModal(this.modals.delete);
                
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            console.error('Delete error:', error);
            if (window.toast) window.toast.error(`Failed to delete: ${error.message}`);
        } finally {
            window.galleryCore.LoadingManager.setButtonLoading(deleteBtn, false);
        }
    }
}

/**
 * File Handler
 * Manages file upload, drag & drop, and validation
 */
class FileHandler {
  constructor(config) {
    this.config = config;
    this.init();
  }

  init() {
    this.initDragDrop();
    this.initPasteSupport();
  }

  validateFile(file) {
    if (!this.config.ALLOWED_TYPES.includes(file.type)) {
      if (window.toast) window.toast.error('Invalid file type. Please select: JPG, PNG, GIF, WebP, or SVG');
      return false;
    }
    
    if (file.size > this.config.MAX_FILE_SIZE) {
      if (window.toast) window.toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size: 15MB`);
      return false;
    }
    
    return true;
  }

  createPreview(file, container) {
    if (!this.validateFile(file)) return;
    
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-wrapper';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (window.toast) {
        window.toast.success(`Image loaded: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
      }
    };

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove image';
    removeBtn.addEventListener('click', () => {
      wrapper.remove();
      if (window.toast) window.toast.info('Image preview removed');
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  }

  initDragDrop() {
    this.setupDropZone(
      document.getElementById('drop-zone'),
      document.getElementById('file-input'),
      document.getElementById('preview-container')
    );

    this.setupDropZone(
      document.getElementById('edit-drop-zone'),
      document.getElementById('edit-file-input'),
      document.getElementById('edit-preview-container')
    );
  }

  setupDropZone(dropZone, fileInput, previewContainer) {
    if (!dropZone || !fileInput || !previewContainer) return;

    dropZone.addEventListener('click', () => {
      fileInput.click();
      if (window.toast) window.toast.info('Select an image file');
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        this.createPreview(fileInput.files[0], previewContainer);
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      
      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find(file => this.config.ALLOWED_TYPES.includes(file.type));

      if (imageFile) {
        const dt = new DataTransfer();
        dt.items.add(imageFile);
        fileInput.files = dt.files;
        this.createPreview(imageFile, previewContainer);
      } else {
        if (window.toast) window.toast.error('Please drop a valid image file');
      }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
  }

  initPasteSupport() {
    document.addEventListener('paste', (e) => {
      const items = Array.from(e.clipboardData.files);
      const imageFile = items.find(file => this.config.ALLOWED_TYPES.includes(file.type));
      
      if (!imageFile) return;

      const addModal = document.getElementById('add-artwork-modal');
      const editModal = document.getElementById('edit-artwork-modal');

      if (addModal && addModal.style.display === 'block') {
        const fileInput = document.getElementById('file-input');
        const previewContainer = document.getElementById('preview-container');
        
        if (fileInput && previewContainer) {
          const dt = new DataTransfer();
          dt.items.add(imageFile);
          fileInput.files = dt.files;
          this.createPreview(imageFile, previewContainer);
          if (window.toast) window.toast.success('Image pasted from clipboard');
        }
      } else if (editModal && editModal.style.display === 'block') {
        const fileInput = document.getElementById('edit-file-input');
        const previewContainer = document.getElementById('edit-preview-container');
        
        if (fileInput && previewContainer) {
          const dt = new DataTransfer();
          dt.items.add(imageFile);
          fileInput.files = dt.files;
          this.createPreview(imageFile, previewContainer);
          if (window.toast) window.toast.success('Image pasted from clipboard');
        }
      }
    });
  }
}

/**
 * Form Handler
 * Manages form submissions and artwork CRUD operations
 */
class FormHandler {
  constructor(modalManager) {
    this.modalManager = modalManager;
    this.init();
  }

  init() {
    const addForm = document.getElementById('add-form');
    if (addForm) {
      addForm.addEventListener('submit', (e) => this.handleAdd(e));
    }

    const editForm = document.getElementById('edit-form');
    if (editForm) {
      editForm.addEventListener('submit', (e) => this.handleEdit(e));
    }

    // Listen for core events
    window.addEventListener('addArtworkInPlace', (e) => {
      this.addArtworkToGallery(e.detail);
    });
  }

  async handleAdd(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    window.galleryCore.LoadingManager.setButtonLoading(submitBtn, true);
    if (window.toast) window.toast.info('Uploading artwork...');
    
    try {
      const formData = new FormData(form);
      const imageFile = formData.get('image');
      
      if (!imageFile || imageFile.size === 0) {
        throw new Error('Please select an image file');
      }

      const response = await fetch('/add', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (window.toast) window.toast.success(result.message);
        
        if (result.artwork) {
          const newElement = this.createArtworkElement(result.artwork);
          const gallery = document.getElementById('gallery');
          
          if (gallery.firstChild) {
            gallery.insertBefore(newElement, gallery.firstChild);
          } else {
            gallery.appendChild(newElement);
          }
          
          window.galleryCore.AnimationManager.animateNewArtwork(newElement);
          
          if (window.artGalleryApp?.updateImageCounter) {
            window.artGalleryApp.updateImageCounter();
          }
          
          const newImg = newElement.querySelector('img.lazy');
          if (newImg && window.lazyLoader) {
            window.lazyLoader.observe([newImg]);
          }
        }
        
        form.reset();
        document.getElementById('preview-container').innerHTML = '';
        await this.modalManager.closeModal(document.getElementById('add-artwork-modal'));
        
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error('Add artwork error:', error);
      if (window.toast) window.toast.error(error.message || 'Failed to add artwork');
    } finally {
      window.galleryCore.LoadingManager.setButtonLoading(submitBtn, false);
    }
  }

  async handleEdit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const editId = this.modalManager.currentEditId;
    
    if (!editId) {
      if (window.toast) window.toast.error('No artwork selected for editing');
      return;
    }
    
    window.galleryCore.LoadingManager.setButtonLoading(submitBtn, true);
    if (window.toast) window.toast.info('Updating artwork...');
    
    try {
      const formData = new FormData(form);
      
      const response = await fetch(`/edit/${editId}`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (window.toast) window.toast.success(result.message);
        
        await this.modalManager.closeModal(document.getElementById('edit-artwork-modal'));
        document.getElementById('edit-preview-container').innerHTML = '';
        
        const hasNewImage = formData.get('image') && formData.get('image').size > 0;
        
        if (hasNewImage) {
          setTimeout(() => window.location.reload(), 500);
        } else {
          const artworkEl = document.querySelector(`[data-id="${editId}"]`);
          if (artworkEl && result.artwork) {
            this.updateArtworkText(artworkEl, result.artwork);
            window.galleryCore.AnimationManager.animateUpdate(artworkEl);
          }
        }
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      console.error('Edit artwork error:', error);
      if (window.toast) window.toast.error(error.message || 'Failed to update artwork');
    } finally {
      window.galleryCore.LoadingManager.setButtonLoading(submitBtn, false);
    }
  }

  // ✅ FIXED: Updated createArtworkElement with data-full-src attribute
  createArtworkElement(artwork) {
    const div = document.createElement('div');
    div.className = 'artwork';
    div.dataset.id = artwork.id;
    
    div.innerHTML = `
      <div class="artwork-container">
        <img data-src="${artwork.thumbnail_path}" 
             data-full-src="${artwork.image_path}"
             alt="${artwork.title || ''}" 
             class="lazy">
        <div class="artwork-actions">
          <button class="btn-edit" data-id="${artwork.id}" 
                  data-title="${artwork.title || ''}" 
                  data-description="${artwork.description || ''}">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn-delete" data-id="${artwork.id}" 
                  data-title="${artwork.title || ''}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="artwork-info">
        ${artwork.title ? `<h3 class="artwork-title" data-id="${artwork.id}">${artwork.title}</h3>` : ''}
        <div class="artwork-description">
          <p class="truncated-description">${artwork.description || ''}</p>
          ${artwork.description && artwork.description.length > 120 ? 
            `<button class="btn-see-more" data-id="${artwork.id}">See more</button>` : ''}
        </div>
      </div>
    `;
    
    this.attachElementListeners(div);
    
    return div;
  }

  addArtworkToGallery(artworkData) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return false;
    
    const newElement = this.createArtworkElement(artworkData);
    
    if (gallery.firstChild) {
      gallery.insertBefore(newElement, gallery.firstChild);
    } else {
      gallery.appendChild(newElement);
    }
    
    window.galleryCore.AnimationManager.animateNewArtwork(newElement);
    
    if (window.artGalleryApp?.updateImageCounter) {
      window.artGalleryApp.updateImageCounter();
    }
    
    const newImg = newElement.querySelector('img.lazy');
    if (newImg && window.lazyLoader) {
      window.lazyLoader.observe([newImg]);
    }
    
    return true;
  }

  updateArtworkText(artworkEl, artwork) {
    const titleEl = artworkEl.querySelector('.artwork-title');
    const descEl = artworkEl.querySelector('.truncated-description');
    const seeMoreBtn = artworkEl.querySelector('.btn-see-more');
    
    if (titleEl) {
      titleEl.textContent = artwork.title || '';
    } else if (artwork.title) {
      const infoEl = artworkEl.querySelector('.artwork-info');
      const titleEl = document.createElement('h3');
      titleEl.className = 'artwork-title';
      titleEl.dataset.id = artwork.id;
      titleEl.textContent = artwork.title;
      infoEl.insertBefore(titleEl, infoEl.firstChild);
    }
    
    if (descEl) {
      descEl.textContent = artwork.description || '';
    }
    
    if (artwork.description && artwork.description.length > 120) {
      if (!seeMoreBtn) {
        const btn = document.createElement('button');
        btn.className = 'btn-see-more';
        btn.dataset.id = artwork.id;
        btn.textContent = 'See more';
        artworkEl.querySelector('.artwork-description').appendChild(btn);
        this.attachSeeMoreListener(btn);
      }
    } else if (seeMoreBtn) {
      seeMoreBtn.remove();
    }
    
    const editBtn = artworkEl.querySelector('.btn-edit');
    const deleteBtn = artworkEl.querySelector('.btn-delete');
    
    if (editBtn) {
      editBtn.dataset.title = artwork.title || '';
      editBtn.dataset.description = artwork.description || '';
    }
    
    if (deleteBtn) {
      deleteBtn.dataset.title = artwork.title || '';
    }
  }

  attachElementListeners(element) {
    const editBtn = element.querySelector('.btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const data = {
          id: editBtn.dataset.id,
          title: editBtn.dataset.title,
          description: editBtn.dataset.description
        };
        this.modalManager.openEditModal(data);
      });
    }

    const deleteBtn = element.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const data = {
          id: deleteBtn.dataset.id,
          title: deleteBtn.dataset.title
        };
        this.modalManager.openDeleteModal(data);
      });
    }

    const seeMoreBtn = element.querySelector('.btn-see-more');
    if (seeMoreBtn) {
      this.attachSeeMoreListener(seeMoreBtn);
    }

    const title = element.querySelector('.artwork-title');
    if (title && title.offsetWidth < title.scrollWidth) {
      title.style.cursor = 'pointer';
      title.title = 'Click to view full description';
      title.addEventListener('click', () => {
        if (window.artGalleryApp) {
          window.artGalleryApp.handleViewDescription(title.dataset.id);
        }
      });
    }
  }

  attachSeeMoreListener(btn) {
    btn.addEventListener('click', () => {
      if (window.artGalleryApp) {
        window.artGalleryApp.handleViewDescription(btn.dataset.id);
      }
    });
  }
}

/**
 * Search and Sort functionality
 */
class SearchSort {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.sortSelect = document.getElementById('sort-select');
    this.resultsText = document.getElementById('results-text');
    this.gallery = document.getElementById('gallery');
    
    this.currentQuery = '';
    this.currentSort = 'newest';
    this.debounceTimer = null;
    
    this.init();
  }
  
  init() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.currentQuery = e.target.value.trim();
          this.updateGallery();
        }, 300);
      });
    }
    
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.updateGallery();
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (this.searchInput) {
          this.searchInput.focus();
          this.searchInput.select();
        }
      }
    });
  }
  
  async updateGallery() {
    if (this.gallery) {
      this.gallery.style.opacity = '0.5';
    }
    
    const controls = document.querySelector('.gallery-controls');
    if (controls) {
      controls.classList.add('loading');
    }
    
    try {
      const params = new URLSearchParams({
        q: this.currentQuery,
        sort: this.currentSort
      });
      
      const response = await fetch(`/api/artworks?${params}`);
      const data = await response.json();
      
      if (data.success) {
        this.renderResults(data.artworks);
        this.updateResultsText(data.count);
        
        localStorage.setItem('gallerySort', this.currentSort);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Search error:', error);
      if (window.toast) {
        window.toast.error('Failed to update gallery');
      }
    } finally {
      if (this.gallery) {
        this.gallery.style.opacity = '1';
      }
      if (controls) {
        controls.classList.remove('loading');
      }
    }
  }
  
  renderResults(artworks) {
    if (this.gallery) {
      this.gallery.innerHTML = artworks.map(artwork => this.createArtworkHTML(artwork)).join('');
      
      if (window.lazyLoader) {
        const images = this.gallery.querySelectorAll('img.lazy');
        window.lazyLoader.observe(images);
      }
      
      if (window.galleryCore && window.galleryCore.AnimationManager) {
        window.galleryCore.AnimationManager.initPageAnimations();
      }
    }
  }
  
  // ✅ FIXED: Updated createArtworkHTML with data-full-src attribute
  createArtworkHTML(artwork) {
    return `
      <div class="artwork" data-id="${artwork.id}">
        <div class="artwork-container">
          <img data-src="${artwork.thumbnail_path}" 
               data-full-src="${artwork.image_path}"
               alt="${artwork.title || ''}" 
               class="lazy">
          <div class="artwork-actions">
            <button class="btn-edit" data-id="${artwork.id}" 
                    data-title="${artwork.title || ''}" 
                    data-description="${artwork.description || ''}">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-delete" data-id="${artwork.id}" 
                    data-title="${artwork.title || ''}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="artwork-info">
          ${artwork.title ? `<h3 class="artwork-title">${artwork.title}</h3>` : ''}
          <div class="artwork-description">
            <p class="truncated-description">${artwork.description || ''}</p>
            ${artwork.description?.length > 120 ? 
              `<button class="btn-see-more" data-id="${artwork.id}">See more</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }
  
  updateResultsText(count) {
    if (this.resultsText) {
      if (this.currentQuery) {
        this.resultsText.textContent = `Found ${count} result${count !== 1 ? 's' : ''} for "${this.currentQuery}"`;
      } else {
        this.resultsText.textContent = `Showing all ${count} artwork${count !== 1 ? 's' : ''}`;
      }
    }
  }
}

/* ============================================================================
   2. UI INITIALIZATION & EVENT HANDLING
   ============================================================================ */

/**
 * UI Application Manager
 * Coordinates UI components and handles interactions
 */
class UIManager {
  constructor(coreApp) {
    this.coreApp = coreApp;
    this.config = coreApp.config;
    this.managers = {};
  }

  async init() {
    try {
      console.log('🎨 Initializing UI components...');

      // Initialize UI managers
      this.managers.modal = new ModalManager();
      this.managers.fileHandler = new FileHandler(this.config);
      this.managers.formHandler = new FormHandler(this.managers.modal);
      this.managers.searchSort = new SearchSort();

      // Initialize UI features
      this.initSortable();
      this.initEventListeners();

      // Load saved preferences
      this.loadSavedPreferences();

      console.log('✅ UI components initialized successfully');

      // Show welcome message
      this.showWelcome();

    } catch (error) {
      console.error('Failed to initialize UI:', error);
      if (window.toast) {
        window.toast.error('Failed to initialize UI components');
      }
    }
  }

  initSortable() {
    const gallery = document.getElementById('gallery');
    
    if (gallery && window.Sortable) {
      const sortableInstance = window.Sortable.create(gallery, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        forceFallback: false,
        onStart: () => {
          if (window.toast) window.toast.info('Reordering artworks...');
          gallery.classList.add('is-sorting');
        },
        onEnd: () => {
          gallery.classList.remove('is-sorting');
          this.coreApp.handleOrderUpdate();
        }
      });
      
      gallery._sortable = sortableInstance;
      console.log('✅ Sortable enabled');
    }
  }

  initEventListeners() {
    this.attachStandardListeners();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.managers.modal.closeAllModals();
      }
      if (e.ctrlKey && e.key === 'a' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.managers.modal.openAddModal();
      }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        console.log('📐 Window resized');
      }, 250);
    });
  }

  attachStandardListeners() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    gallery.addEventListener('click', (e) => {
      const target = e.target;

      if (target.closest('.btn-edit')) {
        const btn = target.closest('.btn-edit');
        this.managers.modal.openEditModal({
          id: btn.dataset.id,
          title: btn.dataset.title,
          description: btn.dataset.description
        });
      }

      else if (target.closest('.btn-delete')) {
        const btn = target.closest('.btn-delete');
        this.managers.modal.openDeleteModal({
          id: btn.dataset.id,
          title: btn.dataset.title
        });
      }

      else if (target.closest('.btn-see-more')) {
        const btn = target.closest('.btn-see-more');
        this.coreApp.handleViewDescription(btn.dataset.id);
      }

      else if (target.closest('.artwork-title')) {
        const title = target.closest('.artwork-title');
        if (title.offsetWidth < title.scrollWidth) {
          this.coreApp.handleViewDescription(title.dataset.id);
        }
      }
    });
  }

  loadSavedPreferences() {
    // Load saved sort preference
    const savedSort = localStorage.getItem('gallerySort');
    const sortSelect = document.getElementById('sort-select');
    if (savedSort && sortSelect) {
      sortSelect.value = savedSort;
    }
  }

  showWelcome() {
    setTimeout(() => {
      const artworkCount = document.querySelectorAll('.artwork').length;
      window.toast.success(`Gallery loaded with ${artworkCount} artworks!`, 3000);
    }, 1000);
  }

  // Public API methods
  getManagers() {
    return this.managers;
  }

  getStats() {
    return {
      totalArtworks: document.querySelectorAll('.artwork').length,
      managers: Object.keys(this.managers),
      uiReady: true
    };
  }
}

/* ============================================================================
   3. MAIN UI INITIALIZATION
   ============================================================================ */

/**
 * Initialize UI when core is ready
 */
async function initializeUI() {
  try {
    // Wait for core to be ready
    const core = await waitForCore();
    console.log('🎨 Core ready, initializing UI...');

    // Create UI manager
    const uiManager = new UIManager(core.app);
    await uiManager.init();

    // Expose UI manager globally
    window.galleryUI = {
      manager: uiManager,
      ready: true,
      managers: uiManager.getManagers()
    };

    // Extend core app with UI methods
    if (window.artGalleryApp) {
      window.artGalleryApp.ui = uiManager;
    }

    console.log('✅ Gallery UI fully initialized');

  } catch (error) {
    console.error('Failed to initialize UI:', error);
    if (window.toast) {
      window.toast.error('Failed to initialize gallery UI');
    }
  }
}

// Initialize UI when DOM is ready or core is ready (whichever comes last)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUI);
} else {
  initializeUI();
}

/**
 * ============================================================================
 * END OF GALLERY UI
 * ============================================================================
 */
