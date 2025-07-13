// Metadata Viewer Manager (FIXED SCROLL ISSUE)
class MetadataViewerManager {
    constructor() {
        this.container = null;
        this.toggleButton = null;
        this.isActive = false;
        this.currentFile = null;
        
        this.init();
    }
    
    init() {
        // Create container
        this.createContainer();
        
        // Get toggle button
        this.toggleButton = document.getElementById('metadata-viewer-toggle');
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Metadata Viewer initialized');
    }
    
    createContainer() {
        const container = document.createElement('div');
        container.className = 'metadata-viewer-container';
        container.innerHTML = `
            <div class="metadata-header">
                <button class="metadata-back-btn" id="metadata-back-btn">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Back to Gallery</span>
                </button>
                <h2><i class="fa-solid fa-circle-info"></i> Image Metadata Viewer</h2>
            </div>
            
            <div class="metadata-content">
                <!-- Upload Zone -->
                <div class="metadata-upload-zone" id="metadata-upload-zone">
                    <i class="fa-solid fa-cloud-arrow-up upload-icon"></i>
                    <h3>Upload Image to View Metadata</h3>
                    <p>Drag & drop an image here or click to select</p>
                    <p style="font-size: 0.9rem; opacity: 0.7;">
                        Supports: AI-generated images, Camera photos, EXIF data, GPS info
                    </p>
                    <input type="file" id="metadata-file-input" accept="image/*" hidden>
                </div>
                
                <!-- Image Preview -->
                <div class="metadata-image-preview" id="metadata-image-preview">
                    <div class="preview-image-container">
                        <img id="metadata-preview-img" class="preview-image" alt="Preview">
                        <button class="clear-image-btn" id="clear-metadata-image">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Loading State -->
                <div class="metadata-loading" id="metadata-loading">
                    <div class="metadata-spinner"></div>
                    <p>Extracting metadata...</p>
                </div>
                
                <!-- Metadata Display -->
                <div class="metadata-display" id="metadata-display">
                    <!-- AI Generation Metadata -->
                    <div class="metadata-section" id="ai-metadata-section" style="display: none;">
                        <h3><i class="fa-solid fa-microchip-ai"></i> AI Generation Data</h3>
                        <table class="metadata-table" id="ai-metadata-table"></table>
                    </div>
                    
                    <!-- EXIF Metadata -->
                    <div class="metadata-section" id="exif-metadata-section" style="display: none;">
                        <h3><i class="fa-solid fa-camera"></i> EXIF Data</h3>
                        <table class="metadata-table" id="exif-metadata-table"></table>
                    </div>
                    
                    <!-- GPS Metadata -->
                    <div class="metadata-section" id="gps-metadata-section" style="display: none;">
                        <h3><i class="fa-solid fa-location-dot"></i> GPS Location</h3>
                        <table class="metadata-table" id="gps-metadata-table"></table>
                    </div>
                    
                    <!-- File Info -->
                    <div class="metadata-section" id="file-metadata-section" style="display: none;">
                        <h3><i class="fa-solid fa-file-image"></i> File Information</h3>
                        <table class="metadata-table" id="file-metadata-table"></table>
                    </div>
                    
                    <!-- Other Metadata -->
                    <div class="metadata-section" id="other-metadata-section" style="display: none;">
                        <h3><i class="fa-solid fa-circle-info"></i> Other Metadata</h3>
                        <table class="metadata-table" id="other-metadata-table"></table>
                    </div>
                </div>
                
                <!-- Empty State -->
                <div class="metadata-empty" id="metadata-empty" style="display: none;">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>No metadata found in this image</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        this.container = container;
    }
    
    setupEventListeners() {
        // Toggle button
        this.toggleButton.addEventListener('click', () => this.toggle());
        
        // Back button
        const backButton = document.getElementById('metadata-back-btn');
        backButton.addEventListener('click', () => {
            this.hide();
            if (window.toast) {
                window.toast.success('Returned to gallery');
            }
        });
        
        // Upload zone
        const uploadZone = document.getElementById('metadata-upload-zone');
        const fileInput = document.getElementById('metadata-file-input');
        
        uploadZone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });
        
        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleFile(files[0]);
            }
        });
        
        // Clear image button
        document.getElementById('clear-metadata-image').addEventListener('click', () => {
            this.clearImage();
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.toggle();
            }
        });
    }
    
    toggle() {
        if (this.isActive) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show() {
        // ✅ UPDATED: Scroll bar giờ ở ngoài cùng (container level)
        document.body.classList.add('metadata-viewer-open');
        document.documentElement.classList.add('metadata-viewer-open');
        
        this.container.classList.add('active');
        this.toggleButton.classList.add('active');
        this.isActive = true;
        
        if (window.toast) {
            window.toast.info('Metadata Viewer opened');
        }
    }
    
    hide() {
        // ✅ UPDATED: Khôi phục scroll của body/html
        document.body.classList.remove('metadata-viewer-open');
        document.documentElement.classList.remove('metadata-viewer-open');
        
        this.container.classList.remove('active');
        this.toggleButton.classList.remove('active');
        this.isActive = false;
        
        // Clear any loaded image
        this.clearImage();
        
        if (window.toast) {
            window.toast.info('Back to gallery');
        }
    }
    
    async handleFile(file) {
        if (!file.type.startsWith('image/')) {
            if (window.toast) {
                window.toast.error('Please select an image file');
            }
            return;
        }
        
        this.currentFile = file;
        
        // Show preview
        this.showPreview(file);
        
        // Extract metadata
        await this.extractMetadata(file);
    }
    
    showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('metadata-preview-img').src = e.target.result;
            document.getElementById('metadata-image-preview').classList.add('active');
            document.getElementById('metadata-upload-zone').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
    
    async extractMetadata(file) {
        // Show loading
        document.getElementById('metadata-loading').classList.add('active');
        document.getElementById('metadata-display').classList.remove('active');
        document.getElementById('metadata-empty').style.display = 'none';
        
        try {
            // Create FormData
            const formData = new FormData();
            formData.append('image', file);
            
            // Send to server for metadata extraction
            const response = await fetch('/api/extract-metadata', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.metadata) {
                this.displayMetadata(data.metadata);
            } else {
                console.warn('No metadata found:', data);
                this.showEmpty();
            }
            
        } catch (error) {
            console.error('Metadata extraction error:', error);
            if (window.toast) {
                window.toast.error(`Failed to extract metadata: ${error.message}`);
            }
            this.showEmpty();
        } finally {
            document.getElementById('metadata-loading').classList.remove('active');
        }
    }
    
    displayMetadata(metadata) {
        document.getElementById('metadata-display').classList.add('active');
        
        // Clear all sections first
        this.clearAllSections();
        
        // AI Generation Data
        if (metadata.ai_generation && Object.keys(metadata.ai_generation).length > 0) {
            this.displaySection('ai-metadata', metadata.ai_generation, {
                'prompt': 'Prompt',
                'negative_prompt': 'Negative Prompt',
                'model': 'Model',
                'sampler': 'Sampler',
                'steps': 'Steps',
                'cfg_scale': 'CFG Scale',
                'seed': 'Seed',
                'size': 'Size',
                'width': 'Width',
                'height': 'Height',
                'lora': 'LoRA',
                'scheduler': 'Scheduler'
            });
        }
        
        // EXIF Data
        if (metadata.exif && Object.keys(metadata.exif).length > 0) {
            this.displaySection('exif-metadata', metadata.exif, {
                'Make': 'Camera Make',
                'Model': 'Camera Model',
                'DateTime': 'Date Taken',
                'ExposureTime': 'Exposure Time',
                'FNumber': 'F-Number',
                'ISO': 'ISO Speed',
                'FocalLength': 'Focal Length',
                'LensModel': 'Lens Model',
                'Software': 'Software'
            });
        }
        
        // GPS Data
        if (metadata.gps && Object.keys(metadata.gps).length > 0) {
            this.displaySection('gps-metadata', metadata.gps, {
                'latitude': 'Latitude',
                'longitude': 'Longitude',
                'altitude': 'Altitude',
                'timestamp': 'GPS Timestamp'
            });
        }
        
        // File Info
        if (metadata.file_info && Object.keys(metadata.file_info).length > 0) {
            this.displaySection('file-metadata', metadata.file_info, {
                'filename': 'Filename',
                'size': 'File Size',
                'format': 'Format',
                'dimensions': 'Dimensions',
                'color_mode': 'Color Mode',
                'has_transparency': 'Has Transparency'
            });
        }
        
        // Other Metadata
        if (metadata.other && Object.keys(metadata.other).length > 0) {
            this.displaySection('other-metadata', metadata.other);
        }
        
        // Check if any section is displayed
        const hasData = document.querySelectorAll('.metadata-section[style*="block"]').length > 0;
        if (!hasData) {
            this.showEmpty();
        }
    }
    
    displaySection(sectionId, data, labelMap = {}) {
        const section = document.getElementById(`${sectionId}-section`);
        const table = document.getElementById(`${sectionId}-table`);
        
        if (!section || !table) {
            console.warn(`Section or table not found: ${sectionId}`);
            return;
        }
        
        if (!data || Object.keys(data).length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // Clear table
        table.innerHTML = '';
        
        // Add rows
        Object.entries(data).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const row = document.createElement('tr');
                const label = labelMap[key] || this.formatLabel(key);
                
                row.innerHTML = `
                    <td>${label}</td>
                    <td>${this.formatValue(value)}</td>
                `;
                
                table.appendChild(row);
            }
        });
        
        // Show section if has data
        if (table.rows.length > 0) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    }
    
    formatLabel(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    }
    
    clearAllSections() {
        document.querySelectorAll('.metadata-section').forEach(section => {
            section.style.display = 'none';
            // ✅ FIX: Check if table exists before clearing
            const table = section.querySelector('.metadata-table');
            if (table) {
                table.innerHTML = '';
            }
        });
    }
    
    showEmpty() {
        document.getElementById('metadata-display').classList.remove('active');
        document.getElementById('metadata-empty').style.display = 'block';
    }
    
    clearImage() {
        // Reset UI
        const imagePreview = document.getElementById('metadata-image-preview');
        const uploadZone = document.getElementById('metadata-upload-zone');
        const metadataDisplay = document.getElementById('metadata-display');
        const metadataEmpty = document.getElementById('metadata-empty');
        const fileInput = document.getElementById('metadata-file-input');
        
        if (imagePreview) imagePreview.classList.remove('active');
        if (uploadZone) uploadZone.style.display = 'block';
        if (metadataDisplay) metadataDisplay.classList.remove('active');
        if (metadataEmpty) metadataEmpty.style.display = 'none';
        if (fileInput) fileInput.value = '';
        
        // Clear sections
        this.clearAllSections();
        
        this.currentFile = null;
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.metadataViewer = new MetadataViewerManager();
});