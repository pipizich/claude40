// ============================================================================
// LIGHTBOX MANAGER - FIXED VERSION (Disable trong Select Mode)
// ============================================================================

// ============================================================================
// CORE LIGHTBOX CLASS - FIXED
// ============================================================================

class LightboxCore {
    constructor() {
        this.currentIndex = 0;
        this.images = [];
        this.isOpen = false;
        this.debug = false;
        this.container = null;
        this.elements = {};
        this.keyboardFocusTimeout = null;
        
        this.init();
    }
    
    log(message, data = null) {
        if (this.debug) {
            console.log(`[LIGHTBOX] ${message}`, data || '');
        }
    }
    
    init() {
        this.log('Initializing lightbox core...');
        this.createLightboxHTML();
        this.collectImages();
        this.attachCoreEventListeners();
        this.log('Lightbox core initialization complete');
    }
    
    createLightboxHTML() {
        this.log('Creating lightbox HTML...');
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <div class="lightbox-image-container">
                    <img class="lightbox-image" alt="">
                    <button class="lightbox-nav lightbox-prev" aria-label="Previous image" title="Previous image (←)"></button>
                    <button class="lightbox-nav lightbox-next" aria-label="Next image" title="Next image (→)"></button>
                    <button class="lightbox-close" aria-label="Close lightbox" title="Close (Escape)">&times;</button>
                </div>
                <div class="lightbox-info">
                    <!-- Enhanced title with see more and corner controls -->
                    <div class="lightbox-title-container">
                        <h3 class="lightbox-title">
                            <span class="text-content"></span>
                        </h3>
                        <button class="show-more-btn title-show-more" style="display:none;">See more</button>
                        <button class="edit-btn title-edit-btn" title="Edit title">
                            <i class="fas fa-pen"></i>
                        </button>
                        <div class="title-edit-controls">
                            <button class="save-btn" title="Save (Enter)"><i class="fas fa-check"></i></button>
                            <button class="cancel-btn" title="Cancel (Escape)"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    
                    <!-- Enhanced description with see more and corner controls -->
                    <div class="lightbox-description-container">
                        <p class="lightbox-description">
                            <span class="text-content"></span>
                        </p>
                        <button class="show-more-btn description-show-more" style="display:none;">See more</button>
                        <button class="edit-btn description-edit-btn" title="Edit description">
                            <i class="fas fa-pen"></i>
                        </button>
                        <div class="description-edit-controls">
                            <button class="save-btn" title="Save (Ctrl+Enter)"><i class="fas fa-check"></i></button>
                            <button class="cancel-btn" title="Cancel (Escape)"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    
					<div class="loading-metadata" style="display:none;"></div>
					<div class="metadata-content"></div>
                </div>
            </div>
        `;
        document.body.appendChild(lightbox);
        this.container = lightbox;
        
        this.elements = {
            image: lightbox.querySelector('.lightbox-image'),
            title: lightbox.querySelector('.lightbox-title'),
            titleContent: lightbox.querySelector('.lightbox-title .text-content'),
            titleShowMore: lightbox.querySelector('.title-show-more'),
            description: lightbox.querySelector('.lightbox-description'),
            descriptionContent: lightbox.querySelector('.lightbox-description .text-content'),
            descriptionShowMore: lightbox.querySelector('.description-show-more'),
            metadataContent: lightbox.querySelector('.metadata-content'),
            loadingBar: lightbox.querySelector('.loading-metadata'),
            titleContainer: lightbox.querySelector('.lightbox-title-container'),
            descriptionContainer: lightbox.querySelector('.lightbox-description-container'),
            prevBtn: lightbox.querySelector('.lightbox-prev'),
            nextBtn: lightbox.querySelector('.lightbox-next'),
            closeBtn: lightbox.querySelector('.lightbox-close')
        };
        
        this.log('Lightbox HTML created');
    }
    
    collectImages() {
        this.log('Collecting images...');
        const possibleSelectors = ['.artwork', '.artwork-item', '.gallery-item', '.image-item'];
        let artworks = null;
        
        for (let selector of possibleSelectors) {
            const found = document.querySelectorAll(selector);
            this.log(`Checking selector "${selector}": found ${found.length} elements`);
            if (found.length > 0) {
                artworks = found;
                this.log(`Using selector: ${selector}`);
                break;
            }
        }
        
        if (!artworks || artworks.length === 0) {
            this.log('[ERROR] No artwork elements found!');
            artworks = document.querySelectorAll('img[data-id], .gallery img, .grid img');
            this.log(`Fallback: found ${artworks.length} images`);
        }
        
        this.images = Array.from(artworks).map((artwork, index) => {
            let img = artwork.querySelector('img') || artwork;
            
            return {
                id: artwork.dataset.id || `img_${index}`,
                index: index,
                src: img ? (img.dataset.fullSrc || img.src || img.dataset.src) : '',
                title: this.findTextContent(artwork, ['.artwork-title', '.title', 'h3', 'h4']) || '',
                description: this.findTextContent(artwork, ['.truncated-description', '.description', '.caption']) || ''
            };
        }).filter(item => item.src);
        
        this.log(`Collected ${this.images.length} valid images:`, this.images);
    }
    
    findTextContent(element, selectors) {
        for (let selector of selectors) {
            const found = element.querySelector(selector);
            if (found && found.textContent.trim()) {
                return found.textContent.trim();
            }
        }
        return '';
    }
    
    // ✅ FIXED: Check edit mode trước khi mở lightbox
    isEditSelectMode() {
        // Check multiple ways edit select mode might be active
        return (
            document.body.classList.contains('edit-select-mode') ||
            (window.editModeManager && window.editModeManager.currentMode === 'edit-select') ||
            document.body.classList.contains('disable-lightbox')
        );
    }
    
	attachCoreEventListeners() {
		this.log('Attaching core event listeners...');
		
		// ✅ FIXED: Click on images to open lightbox - Check edit mode trước
		document.addEventListener('click', (e) => {
			// ✅ KIỂM TRA EDIT SELECT MODE TRƯỚC TIÊN
			if (this.isEditSelectMode()) {
				this.log('🚫 Lightbox disabled in edit select mode');
				return; // Không mở lightbox trong select mode
			}
			
			const possibleTargets = [
				e.target.closest('.artwork-container img'),
				e.target.closest('.artwork img'),
				e.target.closest('img[data-id]'),
				e.target.tagName === 'IMG' ? e.target : null
			].filter(Boolean);
			
			let img = null;
			for (let target of possibleTargets) {
				if (target) {
					img = target;
					break;
				}
			}
			
			if (img) {
				// ✅ DOUBLE CHECK: Kiểm tra lại edit mode
				if (this.isEditSelectMode()) {
					this.log('🚫 Lightbox click blocked in select mode');
					return;
				}
				
				e.preventDefault();
				const artwork = img.closest('.artwork') || img.closest('[data-id]') || img.parentElement;
				
				if (artwork && artwork.dataset.id) {
					this.log(`🖱️ Click detected on artwork ID: ${artwork.dataset.id}`);
					this.open(artwork.dataset.id);
				}
			}
		}); 
        
        // Lightbox controls with improved event handling
        this.elements.closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addKeyboardFocus('.lightbox-close');
            this.close();
        });
        
        this.elements.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addKeyboardFocus('.lightbox-prev');
            this.navigate(-1);
        });
        
        this.elements.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addKeyboardFocus('.lightbox-next');
            this.navigate(1);
        });
        
        // Enhanced keyboard shortcuts with visual feedback
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            
            // Let editing handle keyboard if active
            if (this.editingElement) return;
            
            // Core navigation shortcuts with visual feedback
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    this.addKeyboardFocus('.lightbox-close');
                    this.close();
                    break;
                    
                case 'ArrowLeft':
                    e.preventDefault();
                    this.addKeyboardFocus('.lightbox-prev');
                    this.navigate(-1);
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    this.addKeyboardFocus('.lightbox-next');
                    this.navigate(1);
                    break;
                    
                case ' ': // Spacebar
                case 'Enter':
                    e.preventDefault();
                    this.addKeyboardFocus('.lightbox-next');
                    this.navigate(1);
                    break;
                    
                case 'Home':
                    e.preventDefault();
                    this.addKeyboardFocus('.lightbox-prev');
                    if (this.currentIndex > 0) {
                        this.currentIndex = 0;
                        this.loadImage(0);
                    }
                    break;
                    
                case 'End':
                    e.preventDefault();
                    this.addKeyboardFocus('.lightbox-next');
                    if (this.currentIndex < this.images.length - 1) {
                        this.currentIndex = this.images.length - 1;
                        this.loadImage(this.currentIndex);
                    }
                    break;
            }
        });
        
        // Remove keyboard focus class after animation
        document.addEventListener('keyup', (e) => {
            if (!this.isOpen) return;
            this.clearKeyboardFocus();
        });
        
        // Click outside to close (but not when editing)
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container && !this.editingElement) {
                this.close();
            }
        });
        
        // Mouse wheel navigation
        this.container.addEventListener('wheel', (e) => {
            if (!this.isOpen || this.editingElement) return;
            
            e.preventDefault();
            const delta = e.deltaY;
            
            if (delta > 0) {
                // Scroll down - next image
                this.navigate(1);
            } else if (delta < 0) {
                // Scroll up - previous image
                this.navigate(-1);
            }
        }, { passive: false });
        
        // Touch/swipe support for mobile
        this.attachTouchEvents();
        
        this.log('Core event listeners attached');
    }
    
    attachTouchEvents() {
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        
        this.container.addEventListener('touchstart', (e) => {
            if (!this.isOpen || this.editingElement) return;
            
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        }, { passive: true });
        
        this.container.addEventListener('touchend', (e) => {
            if (!this.isOpen || this.editingElement) return;
            
            const touch = e.changedTouches[0];
            endX = touch.clientX;
            endY = touch.clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            // Check if horizontal swipe is significant
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    // Swipe right - previous image
                    this.navigate(-1);
                } else {
                    // Swipe left - next image
                    this.navigate(1);
                }
            }
        }, { passive: true });
    }
    
	async open(target) {
		// ✅ FINAL CHECK: Không mở lightbox trong select mode
		if (this.isEditSelectMode()) {
			this.log('🚫 Lightbox open blocked - in edit select mode');
			return;
		}
		
		this.log(`🚀 Opening lightbox with target:`, target);
		
		// Thu thập lại images mỗi lần mở
		const collectStart = performance.now();
		this.collectImages();
		const collectTime = performance.now() - collectStart;
		this.log(`📊 Images collected in ${collectTime.toFixed(2)}ms`);
		
		let index = -1;
		
		// Xử lý cả ID string và numeric index
		if (typeof target === 'string') {
			// Truyền vào artwork ID
			index = this.images.findIndex(img => img.id === target);
			this.log(`🔍 Finding index for ID "${target}": ${index}`);
		} else if (typeof target === 'number') {
			// Truyền vào index trực tiếp
			index = target;
			this.log(`📍 Using direct index: ${index}`);
		}
		
		// Validation và error handling
		if (index === -1) {
			this.log(`❌ Cannot find image with target:`, target);
			this.log(`📋 Available images:`, this.images.map(img => `${img.id}`));
			
			if (window.toast) {
				window.toast.error('Image not found in gallery');
			}
			return;
		}
		
		if (index < 0 || index >= this.images.length) {
			this.log(`❌ Index ${index} out of range (0-${this.images.length - 1})`);
			if (window.toast) {
				window.toast.error('Invalid image index');
			}
			return;
		}
		
		// Mở lightbox
		this.currentIndex = index;
		this.isOpen = true;
		this.container.style.display = 'flex';
		
		// Focus management for accessibility
		this.container.setAttribute('tabindex', '-1');
		
		setTimeout(() => {
			this.container.classList.add('active');
			this.container.focus();
		}, 10);
		
		await this.loadImage(index);
		document.body.style.overflow = 'hidden';
		
		// Announce to screen readers
		this.announceToScreenReader(`Image ${index + 1} of ${this.images.length} opened`);
		
		this.log(`✅ Lightbox opened successfully at index ${index}`);
	}
    
    async loadImage(index) {
        const imageData = this.images[index];
        this.log(`Loading image at index ${index}:`, imageData);
        
        if (!imageData) {
            this.log('[ERROR] No image data found');
            return;
        }
        
        // Show loading state
        this.elements.image.style.opacity = '0.5';
        
        // Update image with loading state
        const img = new Image();
        img.onload = () => {
            this.elements.image.src = imageData.src;
            this.elements.image.style.opacity = '1';
            this.log('[SUCCESS] Image loaded successfully');
        };
        
        img.onerror = () => {
            this.elements.image.style.opacity = '1';
            this.log('[ERROR] Image failed to load');
        };
        
        img.src = imageData.src;
        
        // Update title and description - will be handled by editing module
        this.updateTextContent('title', imageData.title);
        this.updateTextContent('description', imageData.description);
        
        // Load metadata - will be handled by metadata module
        if (this.showMetadataLoading) {
            this.showMetadataLoading();
            if (this.loadMetadata) {
                await this.loadMetadata(imageData.id);
            }
        }
        
        // Update navigation
        this.updateNavigation();
        
        // Update URL hash for direct linking
        this.updateURLHash(index);
    }
    
    updateTextContent(type, text) {
        const element = type === 'title' ? this.elements.title : this.elements.description;
        const contentElement = type === 'title' ? this.elements.titleContent : this.elements.descriptionContent;
        
        element.classList.remove('empty');
        
        if (text && text.trim()) {
            contentElement.textContent = text;
        } else {
            contentElement.textContent = type === 'title' ? 'Click pen icon to add title...' : 'Click pen icon to add description...';
            element.classList.add('empty');
        }
        
        // Check if we need to show "See more" button - handled by editing module
        if (this.checkTextOverflow) {
            this.checkTextOverflow(type);
        }
    }
    
	navigate(direction) {
		// Don't navigate if editing
		if (this.editingElement) return;
		
		const newIndex = this.currentIndex + direction;
		
		// Refresh images nếu index out of range
		if (newIndex < 0 || newIndex >= this.images.length) {
			this.log(`⚠️ Navigation out of range, refreshing images...`);
			this.collectImages();
		}
		
		const actualNewIndex = Math.max(0, Math.min(newIndex, this.images.length - 1));
		
		if (actualNewIndex !== this.currentIndex) {
			this.currentIndex = actualNewIndex;
			this.loadImage(actualNewIndex);
			
			// Announce navigation to screen readers
			this.announceToScreenReader(`Image ${actualNewIndex + 1} of ${this.images.length}`);
		} else {
			// Provide feedback when at boundaries
			if (newIndex < 0) {
				this.announceToScreenReader('At first image');
			} else {
				this.announceToScreenReader('At last image');
			}
		}
	}
    
    updateNavigation() {
        const isFirst = this.currentIndex === 0;
        const isLast = this.currentIndex === this.images.length - 1;
        
        // Update button states
        this.elements.prevBtn.style.display = isFirst ? 'none' : 'flex';
        this.elements.nextBtn.style.display = isLast ? 'none' : 'flex';
        
        // Update button attributes for accessibility
        this.elements.prevBtn.disabled = isFirst;
        this.elements.nextBtn.disabled = isLast;
        
        // Update titles with current position
        this.elements.prevBtn.title = `Previous image (${this.currentIndex} of ${this.images.length})`;
        this.elements.nextBtn.title = `Next image (${this.currentIndex + 2} of ${this.images.length})`;
    }
    
    close() {
        // Cancel any active editing
        if (this.editingElement && this.cancelEdit) {
            this.cancelEdit(this.editingElement);
        }
        
        this.isOpen = false;
        this.container.classList.remove('active');
        
        // Clear keyboard focus
        this.clearKeyboardFocus();
        
        // Clear URL hash
        if (window.location.hash.startsWith('#lightbox-')) {
            history.replaceState(null, null, window.location.pathname + window.location.search);
        }
        
        setTimeout(() => {
            this.container.style.display = 'none';
            document.body.style.overflow = '';
            
            // Return focus to the original image if possible
            const originalImage = document.querySelector(`[data-id="${this.images[this.currentIndex]?.id}"] img`);
            if (originalImage) {
                originalImage.focus();
            }
        }, 300);
        
        this.announceToScreenReader('Lightbox closed');
    }
    
    // Enhanced keyboard focus management
    addKeyboardFocus(selector) {
        // Clear any existing focus
        this.clearKeyboardFocus();
        
        const element = this.container.querySelector(selector);
        if (element) {
            element.classList.add('keyboard-focus');
            
            // Auto-clear after animation
            this.keyboardFocusTimeout = setTimeout(() => {
                this.clearKeyboardFocus();
            }, 2000);
        }
    }
    
    clearKeyboardFocus() {
        if (this.keyboardFocusTimeout) {
            clearTimeout(this.keyboardFocusTimeout);
            this.keyboardFocusTimeout = null;
        }
        
        this.container.querySelectorAll('.keyboard-focus').forEach(el => {
            el.classList.remove('keyboard-focus');
        });
    }
    
    // URL management for direct linking
    updateURLHash(index) {
        const imageData = this.images[index];
        if (imageData && imageData.id) {
            history.replaceState(null, null, `#lightbox-${imageData.id}`);
        }
    }
    
    // Accessibility announcements
    announceToScreenReader(message) {
        // Create or update aria-live region
        let announcer = document.getElementById('lightbox-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'lightbox-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.style.position = 'absolute';
            announcer.style.left = '-10000px';
            announcer.style.width = '1px';
            announcer.style.height = '1px';
            announcer.style.overflow = 'hidden';
            document.body.appendChild(announcer);
        }
        
        announcer.textContent = message;
    }
    
    // Utility methods for other modules
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeForJs(text) {
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
    
    // Debug methods
    enableDebug() {
        this.debug = true;
        console.log('[DEBUG] Lightbox debug mode enabled');
    }
    
    disableDebug() {
        this.debug = false;
        console.log('[SUCCESS] Lightbox debug mode disabled');
    }
    
    // Public API methods
    getCurrentImage() {
        return this.images[this.currentIndex];
    }
    
    getTotalImages() {
        return this.images.length;
    }
    
    goToImage(index) {
        if (index >= 0 && index < this.images.length) {
            this.currentIndex = index;
            this.loadImage(index);
        }
    }
    
    // Error handling
    handleError(error, context) {
        console.error(`Lightbox error in ${context}:`, error);
        
        if (window.toast) {
            window.toast.error(`Lightbox error: ${error.message}`);
        }
        
        // Try to recover gracefully
        if (this.isOpen && context === 'image_load') {
            // Try to show next/previous image if current fails
            if (this.currentIndex < this.images.length - 1) {
                this.navigate(1);
            } else if (this.currentIndex > 0) {
                this.navigate(-1);
            } else {
                this.close();
            }
        }
    }
}

// ============================================================================
// EDITING MODULE CLASS (unchanged)
// ============================================================================

class LightboxEditing {
    constructor(lightboxCore) {
        this.core = lightboxCore;
        this.editingElement = null;
        this.originalValues = {};
        this.currentTextarea = null;
        this.expandedStates = {
            title: false,
            description: false
        };
        
        this.init();
    }
    
    init() {
        this.setupInlineEditing();
        this.setupSeeMoreFunctionality();
        
        // Expose methods to core
        this.core.editingElement = null;
        this.core.checkTextOverflow = (type) => this.checkTextOverflow(type);
        this.core.cancelEdit = (type) => this.cancelEdit(type);
    }
    
    setupInlineEditing() {
        // Click on edit button to edit
        const titleEditBtn = this.core.container.querySelector('.title-edit-btn');
        const descEditBtn = this.core.container.querySelector('.description-edit-btn');
        
        titleEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.editingElement === 'title') {
                this.cancelEdit('title');
            } else if (!this.editingElement) {
                this.startEditing('title');
            }
        });
        
        descEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.editingElement === 'description') {
                this.cancelEdit('description');
            } else if (!this.editingElement) {
                this.startEditing('description');
            }
        });
        
        // Save/Cancel buttons for title
        const titleControls = this.core.elements.titleContainer.querySelector('.title-edit-controls');
        titleControls.querySelector('.save-btn').addEventListener('click', () => this.saveEdit('title'));
        titleControls.querySelector('.cancel-btn').addEventListener('click', () => this.cancelEdit('title'));
        
        // Save/Cancel buttons for description  
        const descControls = this.core.elements.descriptionContainer.querySelector('.description-edit-controls');
        descControls.querySelector('.save-btn').addEventListener('click', () => this.saveEdit('description'));
        descControls.querySelector('.cancel-btn').addEventListener('click', () => this.cancelEdit('description'));
        
        // Enhanced keyboard handling
        document.addEventListener('keydown', (e) => {
            if (!this.core.isOpen || !this.editingElement) return;
            this.handleEditingKeyboard(e);
        });
    }
    
    setupSeeMoreFunctionality() {
        // See more buttons
        this.core.elements.titleShowMore.addEventListener('click', () => this.toggleSeeMore('title'));
        this.core.elements.descriptionShowMore.addEventListener('click', () => this.toggleSeeMore('description'));
    }
    
    checkTextOverflow(type) {
        const contentElement = type === 'title' ? this.core.elements.titleContent : this.core.elements.descriptionContent;
        const showMoreBtn = type === 'title' ? this.core.elements.titleShowMore : this.core.elements.descriptionShowMore;
        const lineClamp = type === 'title' ? 2 : 3;
        
        // Create a temporary clone to measure full height
        const clone = contentElement.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.width = contentElement.offsetWidth + 'px';
        clone.classList.remove('truncated');
        contentElement.parentElement.appendChild(clone);
        
        const fullHeight = clone.offsetHeight;
        const lineHeight = parseInt(window.getComputedStyle(clone).lineHeight);
        const maxHeight = lineHeight * lineClamp;
        
        clone.remove();
        
        // Show/hide "See more" button based on overflow
        if (fullHeight > maxHeight) {
            showMoreBtn.style.display = 'inline-block';
            if (!this.expandedStates[type]) {
                contentElement.classList.add('truncated');
                showMoreBtn.textContent = 'See more';
            }
        } else {
            showMoreBtn.style.display = 'none';
            contentElement.classList.remove('truncated');
            this.expandedStates[type] = false;
        }
    }
    
    toggleSeeMore(type) {
        const contentElement = type === 'title' ? this.core.elements.titleContent : this.core.elements.descriptionContent;
        const showMoreBtn = type === 'title' ? this.core.elements.titleShowMore : this.core.elements.descriptionShowMore;
        
        this.expandedStates[type] = !this.expandedStates[type];
        
        if (this.expandedStates[type]) {
            contentElement.classList.remove('truncated');
            showMoreBtn.textContent = 'See less';
        } else {
            contentElement.classList.add('truncated');
            showMoreBtn.textContent = 'See more';
        }
    }
    
    startEditing(type) {
        if (this.editingElement) return;
        
        this.editingElement = type;
        this.core.editingElement = type; // Sync with core
        
        const element = type === 'title' ? this.core.elements.title : this.core.elements.description;
        const contentElement = type === 'title' ? this.core.elements.titleContent : this.core.elements.descriptionContent;
        const editBtn = type === 'title' ? 
            this.core.container.querySelector('.title-edit-btn') :
            this.core.container.querySelector('.description-edit-btn');
        const controls = type === 'title' ? 
            this.core.elements.titleContainer.querySelector('.title-edit-controls') :
            this.core.elements.descriptionContainer.querySelector('.description-edit-controls');
        
        // Add highlight animation
        element.classList.add('editing-highlight');
        setTimeout(() => element.classList.remove('editing-highlight'), 500);
        
        // Update edit button state
        editBtn.classList.add('editing');
        editBtn.innerHTML = '<i class="fas fa-times"></i>'; // Change to cancel icon
        editBtn.title = 'Cancel editing (Escape)';
        
        // Hide see more button during editing
        const showMoreBtn = type === 'title' ? this.core.elements.titleShowMore : this.core.elements.descriptionShowMore;
        showMoreBtn.style.display = 'none';
        
        // Store original value
        this.originalValues[type] = contentElement.textContent.trim();
        
        // Handle empty placeholder text
        let textValue = this.originalValues[type];
        if (textValue === 'Click pen icon to add title...' || textValue === 'Click pen icon to add description...') {
            textValue = '';
        }
        
        // Create textarea for better plain text editing
        const textarea = document.createElement('textarea');
        textarea.value = textValue;
        textarea.className = 'editing-textarea';
        textarea.style.minHeight = type === 'title' ? '60px' : '120px';
        textarea.style.maxHeight = type === 'title' ? '200px' : '400px';
        
        // Replace content with textarea
        contentElement.style.display = 'none';
        contentElement.parentNode.insertBefore(textarea, contentElement);
        
        // Focus and select all
        textarea.focus();
        setTimeout(() => textarea.select(), 10); // Small delay for better cross-browser support
        
        // Enhanced keyboard handling for textarea
        textarea.addEventListener('keydown', (e) => {
            // Ctrl+A support
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                textarea.select();
                return;
            }
            
            // Save shortcuts
            if (e.key === 'Enter') {
                if (type === 'title' || e.ctrlKey) {
                    e.preventDefault();
                    this.saveEdit(type);
                }
            }
            
            // Cancel shortcut
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEdit(type);
            }
            
            // Prevent other lightbox shortcuts while editing
            e.stopPropagation();
        });
        
        // Show controls
        controls.classList.add('visible');
        
        // Store textarea reference for cleanup
        this.currentTextarea = textarea;
        
        // Prevent lightbox navigation while editing
        this.core.container.classList.add('editing-mode');
        
        this.core.log(`Started editing ${type} with pen icon`);
        
        if (window.toast) {
            const shortcut = type === 'title' ? 'Enter' : 'Ctrl+Enter';
            window.toast.info(`Editing ${type}. Press ${shortcut} to save, Escape to cancel.`);
        }
    }
    
	async saveEdit(type) {
		if (this.editingElement !== type || !this.currentTextarea) return;
		
		const newValue = this.currentTextarea.value.trim();
		const currentImage = this.core.images[this.core.currentIndex];
		
		if (!currentImage) {
			this.cancelEdit(type);
			return;
		}
		
		// Show loading state
		const controls = type === 'title' ? 
			this.core.elements.titleContainer.querySelector('.title-edit-controls') :
			this.core.elements.descriptionContainer.querySelector('.description-edit-controls');
		
		const saveBtn = controls.querySelector('.save-btn');
		const originalHTML = saveBtn.innerHTML;
		saveBtn.innerHTML = '⏳';
		saveBtn.disabled = true;
		
		try {
			// Prepare update data
			const updateData = {
				[type]: newValue
			};
			
			// Send update to server
			const response = await fetch(`/api/artwork/${currentImage.id}/update-text`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});
			
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			
			const result = await response.json();
			
			if (result.success) {
				// Update local data
				currentImage[type] = newValue;
				
				// Update content element with new value
				const contentElement = type === 'title' ? this.core.elements.titleContent : this.core.elements.descriptionContent;
				contentElement.textContent = newValue || (type === 'title' ? 'Click pen icon to add title...' : 'Click pen icon to add description...');
				
				// Update DOM in gallery
				this.updateGalleryElement(currentImage.id, type, newValue);
				
				this.finishEditing(type);
				
				// Apply success animation
				const container = type === 'title' ? this.core.elements.titleContainer : this.core.elements.descriptionContainer;
				container.classList.add('update-success');
				setTimeout(() => container.classList.remove('update-success'), 1000);
				
				if (window.toast) {
					window.toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully!`);
				}
				
				this.core.log(`Successfully updated ${type}: "${newValue}"`);
				
			} else {
				throw new Error(result.message || 'Update failed');
			}
			
		} catch (error) {
			console.error(`Failed to update ${type}:`, error);
			
			// Rollback on error - restore textarea value
			this.currentTextarea.value = this.originalValues[type];
			
			if (window.toast) {
				window.toast.error(`Failed to update ${type}: ${error.message}`);
			}
			
			this.cancelEdit(type);
		} finally {
			saveBtn.innerHTML = originalHTML;
			saveBtn.disabled = false;
		}
	}
    
    cancelEdit(type) {
        if (this.editingElement !== type) return;
        
        // Restore original value to content element
        const contentElement = type === 'title' ? this.core.elements.titleContent : this.core.elements.descriptionContent;
        const originalValue = this.originalValues[type];
        
        contentElement.textContent = originalValue || (type === 'title' ? 'Click pen icon to add title...' : 'Click pen icon to add description...');
        
        this.finishEditing(type);
        
        this.core.log(`Cancelled editing ${type}`);
    }
    
    finishEditing(type) {
        const element = type === 'title' ? this.core.elements.title : this.core.elements.description;
        const contentElement = type === 'title' ? this.core.elements.titleContent : this.core.elements.descriptionContent;
        const editBtn = type === 'title' ? 
            this.core.container.querySelector('.title-edit-btn') :
            this.core.container.querySelector('.description-edit-btn');
        const controls = type === 'title' ? 
            this.core.elements.titleContainer.querySelector('.title-edit-controls') :
            this.core.elements.descriptionContainer.querySelector('.description-edit-controls');
        
        // Restore edit button
        editBtn.classList.remove('editing');
        editBtn.innerHTML = '<i class="fas fa-pen"></i>';
        editBtn.title = `Edit ${type}`;
        
        // Remove textarea and restore content
        if (this.currentTextarea) {
            this.currentTextarea.remove();
            this.currentTextarea = null;
        }
        
        contentElement.style.display = '';
        
        // Update empty state
        const text = contentElement.textContent.trim();
        element.classList.remove('empty');
        if (!text || text === 'Click pen icon to add title...' || text === 'Click pen icon to add description...') {
            element.classList.add('empty');
        }
        
        // Remove editing classes
        element.classList.remove('editable-' + type);
        element.classList.remove('editing');
        contentElement.removeAttribute('data-placeholder');
        
        // Hide controls
        controls.classList.remove('visible');
        
        // Re-enable lightbox navigation
        this.core.container.classList.remove('editing-mode');
        
        // Clear editing state
        this.editingElement = null;
        this.core.editingElement = null; // Sync with core
        delete this.originalValues[type];
        
        // Check if we need to show "See more" button again
        this.checkTextOverflow(type);
    }
    
    updateGalleryElement(artworkId, type, newValue) {
        // Update the corresponding element in the main gallery
        const galleryArtwork = document.querySelector(`[data-id="${artworkId}"]`);
        if (!galleryArtwork) return;
        
        if (type === 'title') {
            const titleElement = galleryArtwork.querySelector('.artwork-title');
            if (titleElement) {
                titleElement.textContent = newValue;
                
                // Update data attributes for edit modal
                const editBtn = galleryArtwork.querySelector('.btn-edit');
                if (editBtn) {
                    editBtn.dataset.title = newValue;
                }
            } else if (newValue) {
                // Create title element if it doesn't exist
                const infoContainer = galleryArtwork.querySelector('.artwork-info');
                if (infoContainer) {
                    const titleEl = document.createElement('h3');
                    titleEl.className = 'artwork-title';
                    titleEl.dataset.id = artworkId;
                    titleEl.textContent = newValue;
                    infoContainer.insertBefore(titleEl, infoContainer.firstChild);
                    
                    // Update edit button
                    const editBtn = galleryArtwork.querySelector('.btn-edit');
                    if (editBtn) {
                        editBtn.dataset.title = newValue;
                    }
                }
            }
        } else if (type === 'description') {
            const descElement = galleryArtwork.querySelector('.truncated-description');
            if (descElement) {
                descElement.textContent = newValue;
                
                // Update data attributes for edit modal
                const editBtn = galleryArtwork.querySelector('.btn-edit');
                if (editBtn) {
                    editBtn.dataset.description = newValue;
                }
                
                // Handle "See more" button
                const seeMoreBtn = galleryArtwork.querySelector('.btn-see-more');
                if (newValue.length > 120) {
                    if (!seeMoreBtn) {
                        const btn = document.createElement('button');
                        btn.className = 'btn-see-more';
                        btn.dataset.id = artworkId;
                        btn.textContent = 'See more';
                        descElement.parentElement.appendChild(btn);
                    }
                } else {
                    if (seeMoreBtn) {
                        seeMoreBtn.remove();
                    }
                }
            }
        }
        
        // Add update animation
        if (galleryArtwork && window.AnimationManager) {
            window.AnimationManager.animateUpdate(galleryArtwork);
        }
    }
    
    handleEditingKeyboard(e) {
        // Let textarea handle its own keyboard events
        if (e.target.classList && e.target.classList.contains('editing-textarea')) {
            return;
        }
        
        // Global editing shortcuts (when not focused on textarea)
        if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelEdit(this.editingElement);
        }
        
        // Prevent other shortcuts while editing
        e.stopPropagation();
    }
}

// ============================================================================
// METADATA MODULE CLASS (unchanged)
// ============================================================================

class LightboxMetadata {
    constructor(lightboxCore) {
        this.core = lightboxCore;
        this.copyTimeouts = new Map(); // ✅ THÊM DÒNG NÀY
        
        this.init();
    }
    
    init() {
        // Expose methods to core
        this.core.showMetadataLoading = () => this.showMetadataLoading();
        this.core.loadMetadata = (artworkId) => this.loadMetadata(artworkId);
    }
    
    showMetadataLoading() {
        this.core.elements.loadingBar.style.display = 'block';
        this.core.elements.metadataContent.innerHTML = '<p style="color: #8be9fd;">Loading AI metadata...</p>';
    }
    
    hideMetadataLoading() {
        this.core.elements.loadingBar.style.display = 'none';
    }
    
    async loadMetadata(artworkId) {
        try {
            const response = await fetch(`/api/metadata/${artworkId}`);
            const data = await response.json();
            
            this.hideMetadataLoading();
            
            if (data.success && data.metadata) {
                this.displayEnhancedMetadata(data.metadata);
            } else {
                this.displayEnhancedMetadata(null);
            }
        } catch (error) {
            this.hideMetadataLoading();
            this.displayEnhancedMetadata(null);
        }
    }
    
    displayEnhancedMetadata(metadata) {
        const container = this.core.elements.metadataContent;
        
        if (!metadata || Object.keys(metadata).length === 0) {
            container.innerHTML = '<p style="color: #ff6b6b; padding: 15px; text-align: center; font-style: italic;">No AI metadata found</p>';
            return;
        }
        
        let html = '';
        
        // 1. Prompts section (always show first if available) - DIRECT DISPLAY
        if (metadata.prompt || metadata.negative_prompt) {
            html += this.createPromptSections(metadata.prompt, metadata.negative_prompt);
        }
        
        // 2. Model & LoRA section - EXPANDED BY DEFAULT
        if (metadata.model || metadata.lora) {
            html += `
                <div class="collapsible-section expanded">
                    <div class="section-header" onclick="window.galleryLightbox?.toggleSection?.(this)">
                        <h5><i class="fa-regular fa-microchip-ai"></i> MODEL & LORA</h5>
                        <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    </div>
                    <div class="section-content">
                        <div class="metadata-grid">
                            ${metadata.model ? `
                                <div class="metadata-item">
                                    <span class="metadata-label">Model</span>
                                    <div class="metadata-value">${this.core.escapeHtml(metadata.model)}</div>
                                </div>
                            ` : ''}
                            ${metadata.lora ? `
                                <div class="metadata-item">
                                    <span class="metadata-label">LoRA</span>
                                    <div class="metadata-value lora-container">
                                        ${this.formatLoRAs(metadata.lora)}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 3. Generation Parameters section - EXPANDED BY DEFAULT
        const paramFields = [
            { key: 'seed', label: 'Seed', copyable: true },
            { key: 'steps', label: 'Steps' },
            { key: 'cfg_scale', label: 'CFG Scale' },
            { key: 'sampler', label: 'Sampler' },
            { key: 'scheduler', label: 'Scheduler' }
        ];
        
        const paramItems = paramFields
            .filter(f => metadata[f.key])
            .map(f => this.createMetadataItem({
                ...f,
                value: metadata[f.key],
                type: f.copyable ? 'copyable' : 'simple'
            }));
        
        if (paramItems.length > 0) {
            html += `
                <div class="collapsible-section expanded">
                    <div class="section-header" onclick="window.galleryLightbox?.toggleSection?.(this)">
                        <h5><i class="fa-regular fa-gear-complex"></i> GENERATION PARAMETERS</h5>
                        <span class="toggle-icon"><i class="fa-solid fa-chevron-down"></i></i></span>
                    </div>
                    <div class="section-content">
                        <div class="metadata-grid">
                            ${paramItems.join('')}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 4. Image Details section - EXPANDED BY DEFAULT
        const hasSize = metadata.width && metadata.height;
        const hasDate = metadata.generation_date;
        const hasAspectRatio = metadata.aspect_ratio;
        
        if (hasSize || hasDate || hasAspectRatio) {
            html += `
                <div class="collapsible-section expanded">
                    <div class="section-header" onclick="window.galleryLightbox?.toggleSection?.(this)">
                        <h5><i class="fa-regular fa-square-info"></i> IMAGE DETAILS</h5>
                        <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    </div>
                    <div class="section-content">
                        <div class="metadata-grid">
                            ${hasSize ? `
                                <div class="metadata-item">
                                    <span class="metadata-label">Size</span>
                                    <div class="metadata-value">${metadata.width} × ${metadata.height}</div>
                                </div>
                            ` : ''}
                            ${hasAspectRatio ? `
                                <div class="metadata-item">
                                    <span class="metadata-label">Aspect Ratio</span>
                                    <div class="metadata-value">${this.core.escapeHtml(metadata.aspect_ratio)}</div>
                                </div>
                            ` : ''}
                            ${hasDate ? `
                                <div class="metadata-item">
                                    <span class="metadata-label">Generated</span>
                                    <div class="metadata-value">${this.formatDate(metadata.generation_date)}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    createPromptSections(prompt, negativePrompt) {
        let html = '';
        
        if (prompt) {
            const isLongPrompt = prompt.length > 180; // Reduced threshold for better UX
            const promptId = 'prompt_' + Date.now();
            html += `
                <div class="prompt-section">
                    <div class="prompt-header">
                        <h6><i class="fa-regular fa-pen-to-square"></i> PROMPT</h6>
                        <button class="prompt-copy-btn" onclick="window.galleryLightbox?.copyToClipboard?.('${this.core.escapeForJs(prompt)}')"><i class="fa-regular fa-clipboard"></i> Copy</button>
                    </div>
                    <div class="prompt-content ${isLongPrompt ? 'collapsed' : 'expanded'}" id="${promptId}">
                        <div class="prompt-text">${this.core.escapeHtml(prompt)}</div>
                        ${isLongPrompt ? `<button class="prompt-show-more" onclick="window.galleryLightbox?.togglePromptExpansion?.(this)">Show more</button>` : ''}
                    </div>
                </div>
            `;
        }
        
        if (negativePrompt) {
            const isLongNegative = negativePrompt.length > 180; // Reduced threshold
            const negPromptId = 'neg_prompt_' + Date.now();
            html += `
                <div class="prompt-section negative-prompt-section">
                    <div class="prompt-header">
                        <h6><i class="fa-regular fa-hexagon-minus"></i> NEGATIVE PROMPT</h6>
                        <button class="prompt-copy-btn" onclick="window.galleryLightbox?.copyToClipboard?.('${this.core.escapeForJs(negativePrompt)}')"><i class="fa-regular fa-clipboard"></i> Copy</button>
                    </div>
                    <div class="prompt-content ${isLongNegative ? 'collapsed' : 'expanded'}" id="${negPromptId}">
                        <div class="prompt-text">${this.core.escapeHtml(negativePrompt)}</div>
                        ${isLongNegative ? `<button class="prompt-show-more" onclick="window.galleryLightbox?.togglePromptExpansion?.(this)">Show more</button>` : ''}
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    formatLoRAs(loraString) {
        // Split by comma and create individual tags
        const loras = loraString.split(',').map(l => l.trim()).filter(l => l);
        
        return loras.map(lora => {
            // Check if it has weight (format: name:weight)
            const parts = lora.split(':');
            const name = parts[0];
            const weight = parts[1] || '1.0';
            
            return `<span class="lora-tag" title="${this.core.escapeHtml(lora)}">${this.core.escapeHtml(name)} <small>${weight}</small></span>`;
        }).join('');
    }
    
    formatDate(dateValue) {
        if (!dateValue) return null;
        
        try {
            // Handle different date formats
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return dateValue;
            
            // Format as readable date
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            return dateValue;
        }
    }
    
    createMetadataItem(item) {
        if (!item.value) return '';
        
        let valueHtml = '';
        
        switch (item.type) {
            case 'copyable':
                valueHtml = `
                    <div class="metadata-value copyable-text">
                        ${this.core.escapeHtml(item.value)}
                        <button class="copy-btn" onclick="window.galleryLightbox?.copyToClipboard?.('${this.core.escapeForJs(item.value)}')"><i class="fa-regular fa-clipboard"></i></button>
                    </div>
                `;
                break;
                
            default:
                valueHtml = `<div class="metadata-value">${this.core.escapeHtml(item.value)}</div>`;
        }
        
        return `
            <div class="metadata-item">
                <span class="metadata-label">${item.label}</span>
                ${valueHtml}
            </div>
        `;
    }
    
    toggleSection(header) {
        try {
            const section = header.parentElement;
            const isExpanded = section.classList.contains('expanded');
            const icon = header.querySelector('.toggle-icon i');
            
            if (isExpanded) {
                section.classList.remove('expanded');
                icon.className = 'fas fa-chevron-right';
            } else {
                section.classList.add('expanded');
                icon.className = 'fas fa-chevron-down';
            }
        } catch (error) {
            console.error('Error toggling section:', error);
        }
    }
    
    togglePromptExpansion(button) {
        try {
            const promptContent = button.parentElement;
            const isCollapsed = promptContent.classList.contains('collapsed');
            
            if (isCollapsed) {
                promptContent.classList.remove('collapsed');
                promptContent.classList.add('expanded');
                button.textContent = 'Show less';
            } else {
                promptContent.classList.remove('expanded');
                promptContent.classList.add('collapsed');
                button.textContent = 'Show more';
            }
        } catch (error) {
            console.error('Error toggling prompt expansion:', error);
        }
    }
    
	async copyToClipboard(text) {
		try {
			await navigator.clipboard.writeText(text);
			
			// Find the button that was clicked
			const button = window.event?.target || document.activeElement;
			
			if (button && button.tagName === 'BUTTON') {
				// ✅ Cancel timeout cũ nếu có
				const existingTimeout = this.copyTimeouts.get(button);
				if (existingTimeout) {
					clearTimeout(existingTimeout.timeout);
					// Restore về state gốc ngay lập tức
					button.innerHTML = existingTimeout.originalHTML;
					button.style.background = existingTimeout.originalBg;
					button.style.color = existingTimeout.originalColor;
					button.style.transform = existingTimeout.resetTransform;
				}
				
				// ✅ Lưu state gốc (chỉ lưu nếu chưa có timeout đang chạy)
				const originalState = {
					originalHTML: existingTimeout ? existingTimeout.originalHTML : button.innerHTML,
					originalBg: existingTimeout ? existingTimeout.originalBg : button.style.background,
					originalColor: existingTimeout ? existingTimeout.originalColor : button.style.color,
					resetTransform: button.classList.contains('copy-btn') ? 'translateY(-50%)' : ''
				};
				
				// Check class để áp dụng transform phù hợp
				let scaleTransform;
				if (button.classList.contains('copy-btn')) {
					// Button copy metadata - có translateY(-50%)
					scaleTransform = 'translateY(-50%) scale(1.05)';
				} else if (button.classList.contains('prompt-copy-btn')) {
					// Button copy prompt - chỉ cần scale
					scaleTransform = 'scale(1.05)';
				} else {
					// Button khác - chỉ cần scale
					scaleTransform = 'scale(1.05)';
				}
				
				// Apply success feedback
				button.innerHTML = '<i class="fa-solid fa-check"></i>';
				button.style.background = '#77dd77';
				button.style.color = 'white';
				button.style.transform = scaleTransform;
				
				// ✅ Set timeout mới
				const timeout = setTimeout(() => {
					button.innerHTML = originalState.originalHTML;
					button.style.background = originalState.originalBg;
					button.style.color = originalState.originalColor;
					button.style.transform = originalState.resetTransform;
					this.copyTimeouts.delete(button); // ✅ Xóa khỏi Map sau khi restore
				}, 1000);
				
				// ✅ Lưu timeout và state vào Map
				this.copyTimeouts.set(button, {
					timeout,
					...originalState
				});
			}
			
			if (window.toast) {
				window.toast.success('Copied to clipboard!');
			}
			
		} catch (err) {
			console.error('Failed to copy:', err);
			
			// Fallback method
			try {
				const textArea = document.createElement('textarea');
				textArea.value = text;
				textArea.style.position = 'fixed';
				textArea.style.left = '-999999px';
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				
				if (window.toast) {
					window.toast.success('Copied to clipboard!');
				}
			} catch (fallbackError) {
				console.error('Fallback copy also failed:', fallbackError);
				if (window.toast) {
					window.toast.error('Failed to copy to clipboard');
				}
			}
		}
	}
}

// ============================================================================
// MAIN LIGHTBOX MANAGER CLASS - FIXED
// ============================================================================

class Lightbox extends LightboxCore {
    constructor() {
        super();
        
        // Initialize additional modules
        this.editing = new LightboxEditing(this);
        this.metadata = new LightboxMetadata(this);
        
        // Properly expose methods to global scope AFTER initialization
        this.exposeGlobalMethods();
        
        console.log('✨ Enhanced Lightbox with Edit Mode Support initialized');
    }
    
    // Properly expose methods for HTML onclick handlers
	exposeGlobalMethods() {
		// Create a stable reference to methods that can be called from HTML
		window.galleryLightbox = {
			// Core lightbox methods
			open: (target) => this.open(target),
			close: () => this.close(),
			navigate: (direction) => this.navigate(direction),
			
			// Metadata methods
			toggleSection: (header) => this.metadata.toggleSection(header),
			togglePromptExpansion: (button) => this.metadata.togglePromptExpansion(button),
			copyToClipboard: (text) => this.metadata.copyToClipboard(text),
			
			// Editing methods (if needed)
			startEditing: (type) => this.editing.startEditing(type),
			saveEdit: (type) => this.editing.saveEdit(type),
			cancelEdit: (type) => this.editing.cancelEdit(type),
			
			// Utility methods
			getCurrentImage: () => this.images[this.currentIndex],
			isOpen: () => this.isOpen,
			isEditing: () => this.editing.editingElement !== null,
			
			// Edit mode checking methods
			isEditSelectMode: () => this.isEditSelectMode(),
			
			// Utility methods
			refresh: () => this.collectImages(),
			testPerformance: (iterations) => this.testCollectPerformance(iterations),
			
		};
		
		// Also expose the full lightbox instance for advanced usage
		window.galleryLightboxInstance = this;
	}
}

// ============================================================================
// GLOBAL INITIALIZATION
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create the lightbox instance
    const lightbox = new Lightbox();
    
    // Additional safety check
    if (typeof window.galleryLightbox !== 'object') {
        console.error('❌ Failed to expose lightbox methods globally');
    } else {
        console.log('✅ Lightbox methods exposed globally');
        console.log('✅ Edit mode support: Lightbox disabled in select mode');
    }
});