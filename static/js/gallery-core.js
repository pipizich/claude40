/**
 * ============================================================================
 * ART GALLERY - CORE SYSTEM (gallery-core.js)
 * ============================================================================
 * 
 * Core business logic, system services, and animations
 * - Utility Functions
 * - Core System Classes  
 * - Animation System
 * - Main Application Class (business logic only)
 * 
 * Dependencies: None (standalone)
 * Used by: gallery-ui.js
 * 
 * ============================================================================
 */

/* ============================================================================
   1. UTILITY FUNCTIONS
   ============================================================================ */

/**
 * Debounce function for performance optimization
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Enhanced Fetch with timeout and error handling
 */
async function enhancedFetch(url, options = {}) {
  if (!window.networkMonitor.isOnline()) {
    throw new Error('No internet connection');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return data;
    } else {
      throw new Error('Server returned non-JSON response');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }
    throw error;
  }
}

/* ============================================================================
   2. CORE SYSTEM CLASSES
   ============================================================================ */

/**
 * Toast Notification Manager
 * Handles all toast notifications with queue management
 */
class ToastManager {
  constructor() {
    this.container = this.createContainer();
    this.toastCounter = 0;
    this.maxToasts = 3; // Limit to 3 toasts max
  }

  createContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  show(message, type = 'info', duration = 1000) {
    // Check current toast count
    const currentToasts = this.container.querySelectorAll('.toast');
    
    // If already at max, remove oldest toast immediately
    if (currentToasts.length >= this.maxToasts) {
      const oldestToast = currentToasts[0];
      this.removeToastImmediately(oldestToast);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('data-toast-id', ++this.toastCounter);
    
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ⓘ'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;
    
    this.container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    const autoRemove = setTimeout(() => {
      this.removeToast(toast);
    }, duration);
    
    toast.addEventListener('click', () => {
      clearTimeout(autoRemove);
      this.removeToast(toast);
    });
    
    return toast;
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }

  removeToastImmediately(toast) {
    if (!toast || !toast.parentNode) return;
    toast.parentNode.removeChild(toast);
  }

  success(message, duration = 1000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 1000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 1000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 1000) {
    return this.show(message, 'info', duration);
  }

  clear() {
    const toasts = this.container.querySelectorAll('.toast');
    toasts.forEach(toast => this.removeToastImmediately(toast));
  }
}

/**
 * Network Connection Monitor
 * Monitors online/offline status and provides enhanced fetch
 */
class NetworkMonitor {
  constructor() {
    this.online = navigator.onLine;
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }
  
  handleOnline() {
    this.online = true;
    if (window.toast) {
      window.toast.success('Connection restored');
    }
  }
  
  handleOffline() {
    this.online = false;
    if (window.toast) {
      window.toast.warning('No internet connection');
    }
  }
  
  isOnline() {
    return this.online;
  }
}

/**
 * Lazy Image Loader with Intersection Observer
 */
class LazyImageLoader {
  constructor() {
    this.imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          img.classList.add('lazy-loaded');
          observer.unobserve(img);
        }
      });
    });
  }

  observe(images) {
    images.forEach(img => {
      if (img.dataset.src) {
        this.imageObserver.observe(img);
      } else {
        img.classList.add('lazy-loaded');
      }
    });
  }
}

/**
 * Theme Manager with Retro Effects
 */
class ThemeManager {
  constructor() {
    this.theme = localStorage.getItem('theme') || 'light';
    this.retroEffects = localStorage.getItem('retroEffects') !== 'false';
    this.toggle = document.getElementById('theme-toggle');
    this.init();
  }
  
  init() {
    this.applyTheme();
    
    if (this.toggle) {
      this.toggle.addEventListener('click', () => {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveTheme();
        
        document.body.style.transition = 'background-color 0.3s ease';
        
        setTimeout(() => {
          if (window.toast) {
            window.toast.info(`Switched to ${this.theme} mode`);
          }
        }, 100);
      });
    }
  }
  
  saveTheme() {
    localStorage.setItem('theme', this.theme);
  }
  
  applyTheme() {
    document.documentElement.classList.add('theme-transitioning');
    document.documentElement.setAttribute('data-theme', this.theme);
    
    const metaTheme = document.querySelector('meta[name="theme-color"]') || 
                      document.createElement('meta');
    metaTheme.name = 'theme-color';
    metaTheme.content = this.theme === 'dark' ? '#0a0a0a' : '#f5eee6';
    if (!document.querySelector('meta[name="theme-color"]')) {
      document.head.appendChild(metaTheme);
    }
    
    if (this.theme === 'dark') {
      this.addRetroEffect();
    } else {
      this.removeRetroEffect();
    }
    
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 300);
  }
  
  addRetroEffect() {
    if (!this.retroEffects) return;
    
    if (!document.getElementById('retro-scanlines')) {
      const scanlines = document.createElement('div');
      scanlines.id = 'retro-scanlines';
      scanlines.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9998;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255, 255, 255, 0.03) 2px,
          rgba(255, 255, 255, 0.03) 4px
        );
        opacity: 0.2;
      `;
      document.body.appendChild(scanlines);
    }
  }
  
  removeRetroEffect() {
    document.body.style.animation = '';
    const scanlines = document.getElementById('retro-scanlines');
    if (scanlines) {
      scanlines.remove();
    }
  }
  
  toggleRetroEffects() {
    this.retroEffects = !this.retroEffects;
    localStorage.setItem('retroEffects', this.retroEffects);
    
    if (this.theme === 'dark') {
      if (this.retroEffects) {
        this.addRetroEffect();
      } else {
        this.removeRetroEffect();
      }
    }
    
    if (window.toast) {
      window.toast.info(`Retro effects ${this.retroEffects ? 'enabled' : 'disabled'}`);
    }
  }
}

/* ============================================================================
   3. ANIMATION SYSTEM
   ============================================================================ */

/**
 * Animation Queue System
 * Manages all animations with priority-based processing
 */
class AnimationQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentAnimation = null;
    this.animatingElements = new Set();
    this.priorities = {
      HIGH: 3,
      MEDIUM: 2,  
      LOW: 1
    };
  }

  add(element, animationType, options = {}) {
    const elementId = element.dataset.id || element.id || Math.random().toString();
    
    if (this.animatingElements.has(elementId)) {
      // FIXED: Chỉ log warning 1 lần mỗi 2 giây
      if (!this.recentWarnings) this.recentWarnings = new Map();
      
      const warningKey = `${elementId}-${animationType}`;
      const now = Date.now();
      const lastWarning = this.recentWarnings.get(warningKey) || 0;
      
      if (now - lastWarning > 2000) {
        console.log(`⚠️ Skipping duplicate animation for element ${elementId}`);
        this.recentWarnings.set(warningKey, now);
      }
      return;
    }

    this.animatingElements.add(elementId);

    const animation = {
      element,
      elementId,
      type: animationType,
      priority: options.priority || this.priorities.LOW,
      callback: options.callback,
      id: Date.now() + Math.random()
    };

    const insertIndex = this.queue.findIndex(item => item.priority < animation.priority);
    if (insertIndex === -1) {
      this.queue.push(animation);
    } else {
      this.queue.splice(insertIndex, 0, animation);
    }

    if (this.queue.length > 200) {
      console.warn('⚠️ Animation queue too large, dropping oldest low-priority items');
      this.queue = this.queue.filter((item, index) => {
        return index < 150 || item.priority > this.priorities.LOW;
      });
    }

    this.process();
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.currentAnimation = this.queue.shift();
      
      try {
        await this.executeAnimation(this.currentAnimation);
        await this.delay(50);
      } catch (error) {
        console.error('Animation error:', error);
      }
    }

    this.isProcessing = false;
    this.currentAnimation = null;
  }

  async executeAnimation(animation) {
    const { element, elementId, type, callback } = animation;
    
    if (!element || !element.parentNode) {
      this.animatingElements.delete(elementId);
      return;
    }

    try {
      switch (type) {
        case 'new':
          await this.animateNew(element);
          break;
        case 'remove':
          await this.animateRemove(element);
          break;
        case 'update':
          await this.animateUpdate(element);
          break;
        case 'entrance':
          await this.animateEntrance(element);
          break;
      }

      if (callback) callback();
    } finally {
      this.animatingElements.delete(elementId);
    }
  }

  async animateNew(element) {
    return new Promise(resolve => {
      this.clearAnimations(element);
      void element.offsetHeight;
      
      element.classList.add('artwork-new');
      
      const handleEnd = () => {
        element.classList.remove('artwork-new');
        element.classList.add('artwork-pulse');
        
        setTimeout(() => {
          element.classList.remove('artwork-pulse');
          element.classList.add('animation-done');
          element.dataset.animated = 'true';
          resolve();
        }, 500);
      };

      element.addEventListener('animationend', handleEnd, { once: true });
      
      setTimeout(() => {
        handleEnd();
      }, 1500);
    });
  }

  async animateRemove(element) {
    return new Promise(resolve => {
      this.clearAnimations(element);
      element.classList.add('artwork-removing');
      
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  async animateUpdate(element) {
    return new Promise(resolve => {
      this.clearAnimations(element);
      element.classList.add('artwork-pulse');
      
      setTimeout(() => {
        element.classList.remove('artwork-pulse');
        resolve();
      }, 1000);
    });
  }

  async animateEntrance(element) {
    return new Promise(resolve => {
      element.classList.add('artwork-entering');
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          element.classList.remove('artwork-entering');
          element.classList.add('artwork-visible');
          
          setTimeout(() => {
            element.classList.add('animation-done');
            resolve();
          }, 300);
        });
      });
    });
  }

  clearAnimations(element) {
    element.classList.remove(
      'artwork-new',
      'artwork-removing',
      'artwork-pulse',
      'artwork-entering',
      'artwork-visible'
    );
    element.style.animation = '';
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cancel(element) {
    this.queue = this.queue.filter(anim => anim.element !== element);
    
    if (this.currentAnimation && this.currentAnimation.element === element) {
      this.clearAnimations(element);
    }
  }

  clear() {
    this.queue = [];
    this.isProcessing = false;
    this.currentAnimation = null;
    this.animatingElements.clear();
  }
}

/**
 * Animation Manager
 * High-level animation control and management
 */
class AnimationManager {
  static queue = new AnimationQueue();

  static initPageAnimations(customElements = null) {
    const allArtworks = customElements || document.querySelectorAll('.artwork');
    
    const artworksToAnimate = Array.from(allArtworks).filter(el => {
      if (el.dataset.animated === 'true' || 
          el.classList.contains('animation-done') ||
          el.classList.contains('artwork-visible') ||
          el.classList.contains('artwork-entering')) {
        return false;
      }
      
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      return rect.top < vh * 2;
    });

    console.log(`📡 Setting up animations for ${artworksToAnimate.length} artworks (filtered from ${allArtworks.length} total)`);

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        const el = entry.target;

        if (entry.isIntersecting && 
            el.dataset.animated !== 'true' &&
            !el.classList.contains('animating')) {
          
          el.classList.add('animating');
          
          this.queue.add(el, 'entrance', {
            priority: this.queue.priorities.LOW,
            callback: () => {
              el.dataset.animated = 'true';
              el.classList.remove('animating');
              obs.unobserve(el);
            }
          });
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });

    artworksToAnimate.forEach(el => {
      observer.observe(el);
    });

    const immediateAnimations = artworksToAnimate.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top <= window.innerHeight;
    });

    immediateAnimations.forEach((el, index) => {
      setTimeout(() => {
        if (el.dataset.animated !== 'true' && !el.classList.contains('animating')) {
          el.classList.add('animating');
          this.queue.add(el, 'entrance', {
            priority: this.queue.priorities.LOW,
            callback: () => {
              el.dataset.animated = 'true';
              el.classList.remove('animating');
              observer.unobserve(el);
            }
          });
        }
      }, index * 30);
    });
  }

  static animateNewArtwork(artworkElement) {
    if (!artworkElement) return;
    
    this.queue.add(artworkElement, 'new', {
      priority: this.queue.priorities.MEDIUM
    });
  }

  static animateRemoveArtwork(artworkElement) {
    return new Promise(resolve => {
      if (!artworkElement) {
        resolve();
        return;
      }
      
      this.queue.add(artworkElement, 'remove', {
        priority: this.queue.priorities.HIGH,
        callback: resolve
      });
    });
  }

  static animateUpdate(element) {
    if (!element) return;
    
    this.queue.add(element, 'update', {
      priority: this.queue.priorities.MEDIUM
    });
  }

  static animateModalOpen(modal) {
    if (!modal) return;
    
    modal.classList.add('modal-entering');
    modal.style.display = 'block';
    
    requestAnimationFrame(() => {
      modal.classList.remove('modal-entering');
      modal.classList.add('modal-visible');
    });
  }

  static animateModalClose(modal) {
    return new Promise(resolve => {
      if (!modal) {
        resolve();
        return;
      }
      
      modal.classList.remove('modal-visible');
      modal.classList.add('modal-entering');
      
      setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('modal-entering');
        resolve();
      }, 300);
    });
  }

  static shouldReduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  static performanceAwareAnimate(callback) {
    if (this.shouldReduceMotion()) {
      return;
    }
    
    if (typeof callback === 'function') {
      callback();
    }
  }

  static fadeIn(element, duration = 300) {
    if (!element) return Promise.resolve();
    
    return new Promise(resolve => {
      element.style.opacity = '0';
      element.style.transition = `opacity ${duration}ms ease`;
      element.style.display = 'block';
      
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  }

  static fadeOut(element, duration = 300) {
    if (!element) return Promise.resolve();
    
    return new Promise(resolve => {
      element.style.opacity = '1';
      element.style.transition = `opacity ${duration}ms ease`;
      
      requestAnimationFrame(() => {
        element.style.opacity = '0';
        setTimeout(() => {
          element.style.display = 'none';
          resolve();
        }, duration);
      });
    });
  }
}

/**
 * Loading Manager
 * Handles loading states and progress indicators
 */
class LoadingManager {
  static setButtonLoading(button, loading = true) {
    if (!button) return;
    
    if (loading) {
      button.disabled = true;
      button.classList.add('loading');
      button.setAttribute('data-original-text', button.textContent);
      button.setAttribute('data-original-html', button.innerHTML);
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      const originalText = button.getAttribute('data-original-text');
      const originalHtml = button.getAttribute('data-original-html');
      if (originalHtml) {
        button.innerHTML = originalHtml;
      } else if (originalText) {
        button.textContent = originalText;
      }
    }
  }

  static showGlobalLoading(message = 'Loading...') {
    let loader = document.querySelector('.global-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.className = 'global-loader';
      loader.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
      `;
      document.body.appendChild(loader);
    } else {
      const messageEl = loader.querySelector('.loading-message');
      if (messageEl) messageEl.textContent = message;
    }
    
    loader.style.display = 'block';
    AnimationManager.fadeIn(loader, 200);
    return loader;
  }

  static hideGlobalLoading() {
    const loader = document.querySelector('.global-loader');
    if (loader) {
      AnimationManager.fadeOut(loader, 200).then(() => {
        loader.style.display = 'none';
      });
    }
  }
}

/* ============================================================================
   4. MAIN APPLICATION CLASS (CORE LOGIC ONLY)
   ============================================================================ */

/**
 * Main Art Gallery Application - Core Logic
 * Business logic and state management only
 */
class ArtGalleryApp {
  constructor() {
    this.managers = {};
    this.config = {
      ANIMATION_STAGGER_DELAY: 50,
      MAX_FILE_SIZE: 15 * 1024 * 1024,
      ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      ENABLE_PERFORMANCE_MONITORING: true
    };
  }

  async init() {
    try {
      const initStart = performance.now();
      
      // Initialize core managers
      this.managers.toast = new ToastManager();
      window.toast = this.managers.toast;
      
      this.managers.network = new NetworkMonitor();
      window.networkMonitor = this.managers.network;
      
      this.managers.theme = new ThemeManager();
      window.themeManager = this.managers.theme;
      
      // Initialize lazy loader
      this.managers.lazyLoader = new LazyImageLoader();
      window.lazyLoader = this.managers.lazyLoader;

      // Initialize core features (will be extended by UI)
      this.initImageCounter();
      this.initErrorHandling();
      this.initPerformanceMonitoring();
      this.initDebugTools();
      this.initLazyLoading();
      this.initAnimations();

      const initTime = performance.now() - initStart;
      console.log(`🎨 Art Gallery Core initialized in ${initTime.toFixed(2)}ms`);
      
      // Signal that core is ready
      window.galleryCore = {
        app: this,
        ready: true,
        managers: this.managers,
        AnimationManager,
        LoadingManager,
        debounce,
        enhancedFetch
      };

      // Dispatch event for UI initialization
      window.dispatchEvent(new CustomEvent('galleryCoreReady', { detail: this }));
      
    } catch (error) {
      console.error('Failed to initialize app core:', error);
      if (window.toast) {
        window.toast.error('Failed to initialize application core');
      }
    }
  }

  initLazyLoading() {
    if (!this.managers.lazyLoader) return;
    
    const lazyImages = document.querySelectorAll('img.lazy');
    this.managers.lazyLoader.observe(lazyImages);
  }

  initImageCounter() {
    const totalImages = document.querySelectorAll('.gallery .artwork').length;
    const counter = document.getElementById('image-total');
    
    if (counter) {
      let current = 0;
      const duration = 800;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        current = Math.floor(totalImages * easeProgress);
        counter.textContent = current;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          counter.textContent = totalImages;
        }
      };
      
      setTimeout(animate, 300);
    }

    this.updateImageCounter = debounce(() => {
      const currentTotal = document.querySelectorAll('.gallery .artwork:not(.artwork-skeleton)').length;
      if (counter) {
        counter.style.transform = 'scale(1.2)';
        counter.textContent = currentTotal;
        setTimeout(() => counter.style.transform = 'scale(1)', 200);
      }
    }, 300);
  }

  initAnimations() {
    console.log('🎬 Initializing animations');
    AnimationManager.initPageAnimations();
  }

  async handleOrderUpdate() {
    try {
      const gallery = document.getElementById('gallery');
      if (!gallery) return;
      
      const artworks = Array.from(gallery.children);
      const totalCount = artworks.length;
      
      const order = artworks.map((el, idx) => ({
        id: el.dataset.id,
        position: totalCount - idx
      }));
      
      const result = await enhancedFetch('/update-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      
      if (result.success && window.toast) {
        window.toast.success('Order updated successfully!');
      }
    } catch (error) {
      console.error('Update order error:', error);
      if (window.toast) window.toast.error('Failed to update order');
    }
  }

  async handleViewDescription(id) {
    const loader = LoadingManager.showGlobalLoading('Loading description...');
    
    try {
      const data = await enhancedFetch(`/get_description/${id}`);
      
      if (data.success) {
        // Will be handled by UI layer
        window.dispatchEvent(new CustomEvent('showDescription', { 
          detail: {
            title: data.title,
            description: data.description
          }
        }));
      } else {
        throw new Error(data.message || 'Failed to load description');
      }
    } catch (error) {
      console.error('Fetch description error:', error);
      if (window.toast) {
        window.toast.error(`Failed to load description: ${error.message}`);
      }
    } finally {
      LoadingManager.hideGlobalLoading();
    }
  }

  initErrorHandling() {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      if (window.toast) {
        window.toast.error('An unexpected error occurred. Please refresh the page.');
      }
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
    });
  }
  
  initPerformanceMonitoring() {
    if (!this.config.ENABLE_PERFORMANCE_MONITORING) return;

    let isMonitoring = false;
    let animationCount = 0;
    
    document.addEventListener('animationstart', () => {
      animationCount++;
      if (!isMonitoring) {
        isMonitoring = true;
        this.startFPSMonitoring();
      }
    });
    
    document.addEventListener('animationend', () => {
      animationCount--;
      if (animationCount <= 0 && isMonitoring) {
        isMonitoring = false;
        this.stopFPSMonitoring();
      }
    });
  }

  startFPSMonitoring() {
    let lastTime = performance.now();
    let frameCount = 0;
    
    this.fpsInterval = setInterval(() => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      if (deltaTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / deltaTime);
        if (fps < 30 && fps > 0) {
          console.warn(`⚠️ Low FPS: ${fps}`);
        }
        frameCount = 0;
        lastTime = currentTime;
      }
    }, 100);
    
    const countFrame = () => {
      frameCount++;
      if (this.fpsInterval) {
        requestAnimationFrame(countFrame);
      }
    };
    requestAnimationFrame(countFrame);
  }

  stopFPSMonitoring() {
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
  }

  initDebugTools() {
    if (typeof window !== 'undefined') {
      window.GalleryDebug = {
        getQueueStatus: () => {
          return {
            queueLength: AnimationManager.queue.queue.length,
            isProcessing: AnimationManager.queue.isProcessing,
            currentAnimation: AnimationManager.queue.currentAnimation
          };
        },

        testAnimationPerformance: () => {
          console.log('🧪 Testing animation performance...');
          const artworks = document.querySelectorAll('.artwork');
          const startTime = performance.now();
          
          artworks.forEach((artwork, index) => {
            setTimeout(() => {
              AnimationManager.animateUpdate(artwork);
            }, index * 10);
          });
          
          setTimeout(() => {
            const endTime = performance.now();
            console.log(`✅ Animation test completed in ${(endTime - startTime).toFixed(2)}ms`);
          }, artworks.length * 10 + 2000);
        },

        clearQueue: () => {
          AnimationManager.queue.clear();
          console.log('✅ Animation queue cleared');
        },

        getMemoryUsage: () => {
          if ('memory' in performance) {
            const memory = performance.memory;
            return {
              used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
              total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
              limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
            };
          }
          return 'Memory API not available';
        },

        getStats: () => {
          return {
            totalArtworks: document.querySelectorAll('.artwork').length,
            animationQueue: this.getQueueStatus(),
            managers: Object.keys(this.managers),
            config: this.config
          };
        }
      };

      window.gDebug = window.GalleryDebug;
      
      console.log('🔧 Gallery Debug Tools Available:');
      console.log('- gDebug.getStats()');
      console.log('- gDebug.getQueueStatus()');
      console.log('- gDebug.testAnimationPerformance()');
      console.log('- gDebug.getMemoryUsage()');
    }
  }

  // Public API methods for UI layer
  addArtworkInPlace(artworkData) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return false;
    
    // Will be implemented by UI layer
    window.dispatchEvent(new CustomEvent('addArtworkInPlace', { detail: artworkData }));
    
    return true;
  }

  removeArtworkInPlace(artworkId) {
    const artworkEl = document.querySelector(`[data-id="${artworkId}"]`);
    if (artworkEl) {
      return AnimationManager.animateRemoveArtwork(artworkEl).then(() => {
        artworkEl.remove();
        this.updateImageCounter();
      });
    }
  }

  getStats() {
    return {
      totalArtworks: document.querySelectorAll('.artwork').length,
      animationQueueLength: AnimationManager.queue.queue.length,
      managers: Object.keys(this.managers),
      performanceMonitoring: this.config.ENABLE_PERFORMANCE_MONITORING
    };
  }
}

/* ============================================================================
   5. CORE INITIALIZATION
   ============================================================================ */

/**
 * Initialize core when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Art Gallery Core Script Loaded');
  
  // Create global app instance
  window.artGalleryApp = new ArtGalleryApp();
  window.artGalleryApp.init();
});

/**
 * ============================================================================
 * END OF GALLERY CORE
 * ============================================================================
 */