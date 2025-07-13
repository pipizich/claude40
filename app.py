#!/usr/bin/env python3
# =============================================================================
# 🎨 ART GALLERY - COMPLETE MERGED APPLICATION
# =============================================================================
# A comprehensive Flask application for managing digital art galleries
# with AI metadata extraction, lightbox editing, and thumbnail generation
# =============================================================================

# =============================================================================
# 📦 IMPORTS SECTION
# =============================================================================
import os
import tempfile
import traceback
import sqlite3
import uuid
import json
import re
import math
import glob
import io
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, render_template, url_for, send_file
from PIL import Image, ExifTags
from PIL.PngImagePlugin import PngInfo
from PIL.ExifTags import TAGS, GPSTAGS

# =============================================================================
# ⚙️ CONFIGURATION SECTION
# =============================================================================
SECRET_KEY = 'art_gallery_secret_key'
UPLOAD_FOLDER = 'static/uploads'
THUMBNAIL_FOLDER = 'static/thumbnails'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
MAX_IMAGE_SIZE = (1920, 1080)
THUMBNAIL_SIZE = (400, 400)
IMAGE_QUALITY = 85

# Ensure upload and thumbnail directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMBNAIL_FOLDER, exist_ok=True)

# =============================================================================
# 🗄️ DATABASE FUNCTIONS SECTION
# =============================================================================
def get_db_connection():
    """Get database connection with row factory"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with tables and indexes"""
    conn = get_db_connection()
    
    # Create artworks table if not exists
    conn.execute('''
    CREATE TABLE IF NOT EXISTS artworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT NOT NULL,
        image_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    conn.commit()

    # Add position column if not exists and initialize
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(artworks)")
    cols = [row[1] for row in cur.fetchall()]
    if 'position' not in cols:
        conn.execute('ALTER TABLE artworks ADD COLUMN position INTEGER')
        conn.execute('UPDATE artworks SET position = id')
        conn.commit()
    
    # Add indexes for better performance
    conn.execute('CREATE INDEX IF NOT EXISTS idx_position ON artworks(position)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON artworks(created_at)')
    conn.commit()
    conn.close()

# =============================================================================
# 🛠️ UTILITY FUNCTIONS SECTION
# =============================================================================
def validate_image_file(file):
    """Validate uploaded image file"""
    if not file or file.filename == '':
        return {'valid': False, 'message': 'No file selected'}
    
    # Check file extension
    if not ('.' in file.filename and 
            file.filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS):
        return {'valid': False, 'message': 'Invalid file type. Please select: JPG, PNG, GIF, WebP, SVG'}
    
    # Check file size
    file.seek(0, 2)  # Go to end of file
    file_length = file.tell()
    file.seek(0)  # Reset to beginning
    
    max_size = 15 * 1024 * 1024  # 15MB
    if file_length > max_size:
        return {'valid': False, 'message': f'File too large ({file_length // 1024 // 1024}MB). Max size: 15MB'}
    
    return {'valid': True, 'message': 'File is valid'}

def cleanup_old_files(image_path):
    """Remove old image and its thumbnail"""
    if image_path and image_path.startswith('static/uploads/') and os.path.exists(image_path):
        try:
            # Remove original image
            os.remove(image_path)
            
            # Remove thumbnail
            thumb_path = image_path.replace('/uploads/', '/thumbnails/')
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
        except OSError as e:
            print(f"Error removing files: {e}")

def ensure_directories():
    """Ensure upload and thumbnail directories exist"""
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(THUMBNAIL_FOLDER, exist_ok=True)

def get_file_size_formatted(size_bytes):
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f}{size_names[i]}"

def cleanup_orphaned_files():
    """Remove files that don't have corresponding database entries"""
    # Get all image paths from database
    conn = get_db_connection()
    db_paths = set()
    artworks = conn.execute('SELECT image_path FROM artworks').fetchall()
    for artwork in artworks:
        db_paths.add(artwork['image_path'])
    conn.close()
    
    # Check files in upload folder
    upload_files = glob.glob(os.path.join(UPLOAD_FOLDER, '*'))
    removed_count = 0
    
    for file_path in upload_files:
        relative_path = file_path.replace('\\', '/')  # Normalize path separators
        if relative_path not in db_paths:
            try:
                os.remove(file_path)
                removed_count += 1
                
                # Also remove corresponding thumbnail
                filename = os.path.basename(file_path)
                thumb_path = os.path.join(THUMBNAIL_FOLDER, filename)
                if os.path.exists(thumb_path):
                    os.remove(thumb_path)
                    
            except OSError as e:
                print(f"Error removing orphaned file {file_path}: {e}")
    
    return removed_count

# =============================================================================
# 🖼️ IMAGE PROCESSING UTILITIES SECTION
# =============================================================================
def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_all_metadata(img):
    """
    Extract both EXIF and PNG metadata from PIL Image object
    Returns: (exif_bytes, pnginfo_object)
    """
    exif_bytes = None
    pnginfo = None
    
    try:
        # Extract EXIF for JPEG
        if hasattr(img, 'getexif'):
            exif_dict = img.getexif()
            if exif_dict:
                exif_bytes = img.info.get('exif')
    except Exception as e:
        print(f"EXIF extraction error: {e}")
    
    try:
        # Extract PNG info
        if img.format == 'PNG' and hasattr(img, 'info') and img.info:
            pnginfo = PngInfo()
            for key, value in img.info.items():
                try:
                    # Convert bytes to string if needed
                    if isinstance(value, bytes):
                        value = value.decode('utf-8', errors='ignore')
                    # Only add text data that PIL can handle
                    if isinstance(value, (str, int, float)):
                        pnginfo.add_text(str(key), str(value))
                except Exception as e:
                    print(f"PNG metadata key {key} skipped: {e}")
    except Exception as e:
        print(f"PNG info extraction error: {e}")
    
    return exif_bytes, pnginfo

def optimize_image_with_metadata(file_stream, max_size=MAX_IMAGE_SIZE, quality=IMAGE_QUALITY):
    """
    Optimized version that properly preserves ALL metadata
    """
    try:
        # Save original position
        original_position = file_stream.tell()
        
        img = Image.open(file_stream)
        original_format = img.format
        
        # Extract ALL metadata BEFORE any modifications
        exif_bytes, pnginfo = extract_all_metadata(img)
        
        # Handle transparency properly
        needs_transparency = img.mode in ('RGBA', 'LA', 'P') and img.format == 'PNG'
        
        if img.mode in ('RGBA', 'LA') and not needs_transparency:
            # Only convert to RGB if not PNG or if user explicitly wants JPEG
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[-1])
            else:  # LA
                background.paste(img)
            img = background
        
        # Resize if too large
        if img.width > max_size[0] or img.height > max_size[1]:
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Prepare output
        output = io.BytesIO()
        save_kwargs = {'optimize': True}
        
        # Determine output format and apply metadata
        if needs_transparency or original_format == 'PNG':
            # Keep as PNG to preserve transparency and PNG-specific metadata
            save_kwargs.update({
                'format': 'PNG',
                'compress_level': 6  # Good compression without quality loss
            })
            if pnginfo:
                save_kwargs['pnginfo'] = pnginfo
        else:
            # Save as JPEG with EXIF
            save_kwargs.update({
                'format': 'JPEG',
                'quality': quality
            })
            if exif_bytes:
                save_kwargs['exif'] = exif_bytes
        
        img.save(output, **save_kwargs)
        output.seek(0)
        
        print(f"✅ Image optimized: {original_format} → {save_kwargs['format']}, metadata preserved")
        return output
        
    except Exception as e:
        print(f"❌ Image optimization error: {e}")
        # Reset file stream and return original
        file_stream.seek(original_position)
        return file_stream

def create_thumbnail_with_metadata(original_path, thumb_size=THUMBNAIL_SIZE):
    """
    Create thumbnail preserving ALL metadata
    """
    try:
        # Create thumbnail directory
        thumb_dir = original_path.replace('/uploads/', '/thumbnails/')
        os.makedirs(os.path.dirname(thumb_dir), exist_ok=True)
        
        # Skip if thumbnail exists
        if os.path.exists(thumb_dir):
            return thumb_dir
            
        img = Image.open(original_path)
        original_format = img.format
        
        # Extract metadata from original
        exif_bytes, pnginfo = extract_all_metadata(img)
        
        # Handle transparency
        needs_transparency = img.mode in ('RGBA', 'LA', 'P') and original_format == 'PNG'
        
        if img.mode in ('RGBA', 'LA') and not needs_transparency:
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
            
        # Create thumbnail
        img.thumbnail(thumb_size, Image.Resampling.LANCZOS)
        
        # Save with metadata
        save_kwargs = {'optimize': True}
        
        if needs_transparency or original_format == 'PNG':
            save_kwargs.update({
                'format': 'PNG',
                'compress_level': 6
            })
            if pnginfo:
                save_kwargs['pnginfo'] = pnginfo
        else:
            save_kwargs.update({
                'format': 'JPEG',
                'quality': 85
            })
            if exif_bytes:
                save_kwargs['exif'] = exif_bytes
        
        img.save(thumb_dir, **save_kwargs)
        print(f"✅ Thumbnail created with metadata: {thumb_dir}")
        
        return thumb_dir
        
    except Exception as e:
        print(f"❌ Thumbnail creation error: {e}")
        return None

def ensure_thumbnails_exist():
    """Generate thumbnails for existing images"""
    uploads = glob.glob('static/uploads/*')
    
    for upload in uploads:
        if any(upload.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
            create_thumbnail_with_metadata(upload)

# Backward compatibility aliases
def optimize_image(file_stream, max_size=MAX_IMAGE_SIZE, quality=IMAGE_QUALITY):
    """Backward compatibility - redirects to optimize_image_with_metadata"""
    return optimize_image_with_metadata(file_stream, max_size, quality)

def create_thumbnail(original_path, thumb_size=THUMBNAIL_SIZE):
    """Backward compatibility - redirects to create_thumbnail_with_metadata"""
    return create_thumbnail_with_metadata(original_path, thumb_size)

# =============================================================================
# 🤖 AI METADATA EXTRACTION SECTION
# =============================================================================
def parse_ai_text_parameters(params_text):
    """
    Parse SD WebUI/A1111/Evoke parameter strings into metadata dict
    Handles multiple formats and edge cases
    """
    metadata = {}
    if not params_text or not isinstance(params_text, str):
        return metadata

    # Extract prompt (everything before "Negative prompt:" or parameters)
    neg_idx = params_text.find('Negative prompt:')
    params_start = None
    
    # Find where parameters start (usually after a newline)
    for marker in ['Steps:', 'Size:', 'Seed:', 'Model:']:
        idx = params_text.find(marker)
        if idx > 0 and (params_start is None or idx < params_start):
            params_start = idx
    
    # Extract main prompt
    if neg_idx > 0:
        metadata['prompt'] = params_text[:neg_idx].strip()
        # Extract negative prompt
        neg_end = params_start if params_start and params_start > neg_idx else len(params_text)
        neg_text = params_text[neg_idx + 16:neg_end].strip()
        # Find actual end of negative prompt (before parameters)
        for marker in ['Steps:', 'Size:', 'Seed:', 'Model:', 'Sampler:']:
            marker_idx = neg_text.find(marker)
            if marker_idx > 0:
                neg_text = neg_text[:marker_idx].strip()
                break
        metadata['negative_prompt'] = neg_text
    elif params_start:
        metadata['prompt'] = params_text[:params_start].strip()
    else:
        # No clear structure, assume it's all prompt
        metadata['prompt'] = params_text.strip()

    # Parameter patterns with more flexibility
    patterns = {
        'steps': r'Steps:\s*(\d+)',
        'sampler': r'Sampler:\s*([^,\n]+?)(?:,|\n|$)',
        'cfg_scale': r'CFG [Ss]cale:\s*([\d.]+)',
        'seed': r'Seed:\s*(\d+)',
        'model': r'Model:\s*([^,\n]+?)(?:,|\n|$)',
        'scheduler': r'Scheduler:\s*([^,\n]+?)(?:,|\n|$)',
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, params_text, re.IGNORECASE)
        if match:
            metadata[key] = match.group(1).strip()
    
    # Size parsing (multiple formats)
    size_patterns = [
        r'Size:\s*(\d+)x(\d+)',
        r'Width:\s*(\d+).*Height:\s*(\d+)',
        r'(\d+)x(\d+)'  # Just dimensions
    ]
    
    for pattern in size_patterns:
        match = re.search(pattern, params_text)
        if match:
            metadata['width'] = match.group(1)
            metadata['height'] = match.group(2)
            break
    
    # Extract LoRAs (multiple formats)
    lora_patterns = [
        r'<lora:([^>]+)>',  # A1111 format
        r'LoRA:\s*\[([^\]]+)\]',  # Alternative format
        r'Lora:\s*"([^"]+)"'  # Another format
    ]
    
    lora_list = []
    for pattern in lora_patterns:
        matches = re.findall(pattern, params_text)
        lora_list.extend(matches)
    
    if lora_list:
        # Remove duplicates while preserving order
        seen = set()
        unique_loras = []
        for lora in lora_list:
            if lora not in seen:
                seen.add(lora)
                unique_loras.append(lora)
        metadata['lora'] = ', '.join(unique_loras)
    
    return metadata

def extract_ai_metadata_detailed(image_path):
    """
    Enhanced extraction for AI-generation metadata only
    Supports: SwarmUI, A1111, ComfyUI, Evoke formats
    """
    print(f"🔍 Extracting AI metadata from: {image_path}")
    metadata = {}
    
    try:
        img = Image.open(image_path)
        print(f"📷 Opened: {img.format} {img.width}x{img.height}")

        # 1. Priority: PNG parameters (most common for AI images)
        if img.format == 'PNG' and hasattr(img, 'info') and img.info:
            if 'parameters' in img.info:
                params = img.info['parameters']
                print(f"📝 Found PNG parameters field")
                
                # Try JSON parse first (SwarmUI format)
                try:
                    data = json.loads(params)
                    if 'sui_image_params' in data:
                        print("✅ Detected SwarmUI format")
                        sui_params = data['sui_image_params']
                        sui_extra = data.get('sui_extra_data', {})
                        
                        # Extract main parameters
                        metadata.update({
                            'prompt': sui_params.get('prompt', ''),
                            'negative_prompt': sui_params.get('negativeprompt', ''),
                            'model': sui_params.get('model', ''),
                            'seed': str(sui_params.get('seed', '')),
                            'steps': str(sui_params.get('steps', '')),
                            'cfg_scale': str(sui_params.get('cfgscale', '')),
                            'sampler': sui_params.get('sampler', ''),
                            'scheduler': sui_params.get('scheduler', ''),
                            'width': str(sui_params.get('width', '')),
                            'height': str(sui_params.get('height', ''))
                        })
                        
                        # Extract LoRAs
                        if 'loras' in sui_params and sui_params['loras']:
                            lora_list = []
                            for lora in sui_params['loras']:
                                model = lora.get('model', 'unknown')
                                weight = lora.get('weight', 1.0)
                                lora_list.append(f"{model}:{weight}")
                            metadata['lora'] = ', '.join(lora_list)
                        
                        # Extract from sui_extra_data
                        if sui_extra:
                            metadata['aspect_ratio'] = sui_extra.get('aspectratio', '')
                            if 'date' in sui_extra:
                                metadata['generation_date'] = sui_extra['date']
                    else:
                        # Try ComfyUI format
                        if 'prompt' in data:
                            print("✅ Detected ComfyUI format")
                            metadata['prompt'] = str(data.get('prompt', ''))
                            if 'workflow' in data:
                                # Extract from workflow nodes
                                workflow = data['workflow']
                                # Complex extraction logic for ComfyUI workflows
                                pass
                        
                except json.JSONDecodeError:
                    print("📄 Parsing as text format (A1111/Evoke)")
                    # Parse A1111/Evoke text format
                    metadata.update(parse_ai_text_parameters(params))
            
            # Check other PNG text chunks
            for key in ['prompt', 'negative_prompt', 'model', 'parameters']:
                if key in img.info and key != 'parameters':
                    metadata[key] = img.info[key]
        
        # 2. Check EXIF for AI metadata (some tools use this)
        try:
            exif_obj = img.getexif()
            if exif_obj:
                for tag_id, val in exif_obj.items():
                    tag = ExifTags.TAGS.get(tag_id, '')
                    if tag in ('ImageDescription', 'UserComment'):
                        text = val.decode('utf-8', errors='ignore') if isinstance(val, bytes) else str(val)
                        # Only parse if it looks like AI parameters
                        if any(keyword in text.lower() for keyword in ['prompt:', 'steps:', 'sampler:', 'model:']):
                            parsed = parse_ai_text_parameters(text)
                            for key, value in parsed.items():
                                if key not in metadata or not metadata[key]:
                                    metadata[key] = value
        except Exception as e:
            print(f"⚠️ EXIF parsing error: {e}")
        
        # 3. Calculate aspect ratio if not present
        if metadata.get('width') and metadata.get('height') and not metadata.get('aspect_ratio'):
            try:
                w, h = int(metadata['width']), int(metadata['height'])
                gcd = math.gcd(w, h)
                metadata['aspect_ratio'] = f"{w//gcd}:{h//gcd}"
            except:
                pass
        
        # 4. Add image dimensions if not in metadata
        if not metadata.get('width') or not metadata.get('height'):
            metadata['width'] = str(img.width)
            metadata['height'] = str(img.height)
        
        print(f"✅ Extracted AI metadata fields: {list(metadata.keys())}")
        return metadata
        
    except Exception as e:
        print(f"❌ Error extracting AI metadata: {e}")
        return {}

def extract_and_store_metadata_separately(image_path):
    """
    IMPROVED: Extract all PNG and EXIF metadata into a flat dict
    """
    try:
        img = Image.open(image_path)
        metadata = {}

        # PNG info - improved handling
        if hasattr(img, 'info') and img.info:
            for key, value in img.info.items():
                try:
                    # Better handling of different value types
                    if isinstance(value, bytes):
                        try:
                            decoded_value = value.decode('utf-8', errors='ignore')
                            metadata[f'png_{key}'] = decoded_value
                        except:
                            metadata[f'png_{key}'] = str(value)
                    elif isinstance(value, (str, int, float)):
                        metadata[f'png_{key}'] = value
                    else:
                        metadata[f'png_{key}'] = str(value)
                except Exception as e:
                    print(f"PNG metadata key {key} error: {e}")

        # EXIF - improved handling
        try:
            exif_obj = img.getexif()
            if exif_obj:
                for tag_id, val in exif_obj.items():
                    tag = ExifTags.TAGS.get(tag_id, f'tag_{tag_id}')
                    try:
                        if isinstance(val, bytes):
                            try:
                                metadata[f'exif_{tag}'] = val.decode('utf-8', errors='ignore')
                            except:
                                metadata[f'exif_{tag}'] = str(val)
                        elif isinstance(val, (str, int, float)):
                            metadata[f'exif_{tag}'] = val
                        else:
                            metadata[f'exif_{tag}'] = str(val)
                    except Exception as e:
                        print(f"EXIF tag {tag} error: {e}")
        except Exception as e:
            print(f"EXIF extraction error: {e}")

        print(f"📊 Extracted {len(metadata)} metadata fields from {image_path}")
        return metadata
        
    except Exception as e:
        print(f"❌ Error extracting metadata from {image_path}: {e}")
        return {}

def process_uploaded_image(uploaded_file_path, save_path, thumbnail_path=None):
    """
    FIXED: Full upload processing pipeline that properly preserves metadata
    """
    try:
        # If paths are the same, optimize in place
        if uploaded_file_path == save_path:
            # Read original file
            with open(uploaded_file_path, 'rb') as f:
                optimized_stream = optimize_image_with_metadata(f)
                
            # Write back optimized version
            with open(save_path, 'wb') as out_f:
                out_f.write(optimized_stream.read())
        else:
            # Different paths - copy with optimization
            with open(uploaded_file_path, 'rb') as f:
                optimized_stream = optimize_image_with_metadata(f)
                with open(save_path, 'wb') as out_f:
                    out_f.write(optimized_stream.read())

        # Extract metadata AFTER optimization (from the final saved file)
        original_metadata = extract_and_store_metadata_separately(save_path)

        # Create thumbnail using the optimized image
        if thumbnail_path:
            create_thumbnail_with_metadata(save_path)

        print(f"✅ Image processed successfully: {save_path}")
        print(f"📊 Metadata keys preserved: {list(original_metadata.keys())}")
        
        return original_metadata
        
    except Exception as e:
        print(f"❌ Upload processing failed: {e}")
        return {}

# =============================================================================
# 🔌 API ROUTES SECTION
# =============================================================================
def register_api_routes(app):
    """Register standard API routes"""
    
    @app.route('/get_description/<int:id>')
    def get_description(id):
        try:
            conn = get_db_connection()
            row = conn.execute('SELECT title, description FROM artworks WHERE id=?',(id,)).fetchone()
            conn.close()
            if row:
                return jsonify({
                    'success':True,
                    'title': row['title'] or 'Untitled',
                    'description': row['description'] or 'No description.'
                })
            return jsonify({'success':False,'message':'Not found'}),404
        except Exception as e:
            return jsonify({'success':False,'message':str(e)}),500

    @app.route('/update-order', methods=['POST'])
    def update_order():
        try:
            data = request.get_json()
            order = data.get('order', [])
            conn = get_db_connection()
            for itm in order:
                conn.execute('UPDATE artworks SET position=? WHERE id=?',
                             (itm['position'], itm['id']))
            conn.commit()
            conn.close()
            return jsonify({'success':True,'message':'Order updated'})
        except Exception as e:
            return jsonify({'success':False,'message':str(e)}),500

    @app.route('/api/search')
    def search_artworks():
        q = request.args.get('q','').strip()
        if not q:
            return jsonify({'success':False,'message':'Query required'}),400
        conn = get_db_connection()
        rows = conn.execute(
            """
            SELECT * FROM artworks
            WHERE title LIKE ? OR description LIKE ?
            ORDER BY position DESC
            """, (f'%{q}%',f'%{q}%')
        ).fetchall()
        conn.close()
        arts=[]
        for r in rows:
            d=dict(r)
            fn=os.path.basename(d['image_path'])
            d['thumbnail_path'] = f"/thumbnail/{fn}"
            arts.append(d)
        return jsonify({'success':True,'count':len(arts),'artworks':arts,'query':q})

    @app.route('/api/health')
    def health_check():
        return jsonify({'status':'healthy','service':'art-gallery'})

    @app.route('/api/artworks')
    def get_filtered_artworks():
        q=request.args.get('q','').lower().strip()
        sort=request.args.get('sort','newest')
        sql='SELECT * FROM artworks WHERE 1=1'
        params=[]
        if q:
            sql+=" AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)"
            params.extend([f'%{q}%',f'%{q}%'])
        if sort=='newest': sql+=' ORDER BY created_at DESC, id DESC'
        elif sort=='oldest': sql+=' ORDER BY created_at ASC, id ASC'
        elif sort=='a-z': sql+=' ORDER BY CASE WHEN title IS NULL OR title="" THEN 1 ELSE 0 END, LOWER(title)'
        elif sort=='z-a': sql+=' ORDER BY CASE WHEN title IS NULL OR title="" THEN 1 ELSE 0 END, LOWER(title) DESC'
        conn=get_db_connection()
        rows=conn.execute(sql,params).fetchall()
        conn.close()
        arts=[]
        for r in rows:
            d=dict(r)
            fn=os.path.basename(d['image_path'])
            d['thumbnail_path']=f"/thumbnail/{fn}"
            arts.append(d)
        return jsonify({'success':True,'count':len(arts),'query':q,'sort':sort,'artworks':arts})

    @app.route('/api/metadata/<int:id>')
    def get_image_metadata(id):
        """
        Enhanced endpoint - returns only AI generation metadata
        No database storage, fresh extraction from image file
        """
        try:
            conn = get_db_connection()
            row = conn.execute('SELECT image_path FROM artworks WHERE id=?', (id,)).fetchone()
            conn.close()
            
            if not row:
                return jsonify({'success': False, 'message': 'Artwork not found'}), 404
            
            path = row['image_path']
            if not os.path.exists(path):
                return jsonify({'success': False, 'message': 'Image file missing'}), 404
            
            # Extract AI metadata using enhanced function
            metadata = extract_ai_metadata_detailed(path)
            
            return jsonify({
                'success': True,
                'metadata': metadata
            })
            
        except Exception as e:
            print(f"❌ API error: {e}")
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500

# =============================================================================
# 💡 LIGHTBOX API ROUTES SECTION
# =============================================================================
def register_lightbox_api_routes(app):
    """
    Register API routes specifically for lightbox inline editing
    Separate from modal editing to avoid conflicts
    """
    
    @app.route('/api/artwork/<int:artwork_id>/update-text', methods=['PATCH'])
    def update_artwork_text(artwork_id):
        """
        Update only title and/or description of an artwork (no image changes)
        Used by lightbox inline editing to avoid conflicts with modal editing
        """
        try:
            # Get JSON data from request
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'success': False, 
                    'message': 'No data provided'
                }), 400
            
            # Validate that we only accept title and description
            allowed_fields = {'title', 'description'}
            provided_fields = set(data.keys())
            
            if not provided_fields.issubset(allowed_fields):
                invalid_fields = provided_fields - allowed_fields
                return jsonify({
                    'success': False,
                    'message': f'Invalid fields: {", ".join(invalid_fields)}. Only title and description are allowed.'
                }), 400
            
            if not provided_fields:
                return jsonify({
                    'success': False,
                    'message': 'No valid fields provided'
                }), 400
            
            # Connect to database
            conn = get_db_connection()
            
            # Check if artwork exists
            artwork = conn.execute(
                'SELECT id, title, description FROM artworks WHERE id = ?', 
                (artwork_id,)
            ).fetchone()
            
            if not artwork:
                conn.close()
                return jsonify({
                    'success': False,
                    'message': 'Artwork not found'
                }), 404
            
            # Prepare update data
            update_fields = []
            update_values = []
            
            if 'title' in data:
                title = data['title'].strip() if data['title'] else None
                # Convert empty strings to None for database
                if title == '':
                    title = None
                update_fields.append('title = ?')
                update_values.append(title)
            
            if 'description' in data:
                description = data['description'].strip() if data['description'] else None
                # Convert empty strings to None for database  
                if description == '':
                    description = None
                update_fields.append('description = ?')
                update_values.append(description)
            
            # Add artwork_id for WHERE clause
            update_values.append(artwork_id)
            
            # Build and execute update query
            update_query = f"UPDATE artworks SET {', '.join(update_fields)} WHERE id = ?"
            
            cursor = conn.execute(update_query, update_values)
            conn.commit()
            
            # Get updated artwork data
            updated_artwork = conn.execute(
                'SELECT id, title, description, image_path FROM artworks WHERE id = ?',
                (artwork_id,)
            ).fetchone()
            
            conn.close()
            
            # Log the update
            updated_fields = list(data.keys())
            print(f"✅ Artwork {artwork_id} text updated via lightbox: {', '.join(updated_fields)}")
            
            # Return success response with updated data
            return jsonify({
                'success': True,
                'message': f'Successfully updated {", ".join(updated_fields)}',
                'artwork': {
                    'id': updated_artwork['id'],
                    'title': updated_artwork['title'],
                    'description': updated_artwork['description'],
                    'image_path': updated_artwork['image_path']
                },
                'updated_fields': updated_fields
            })
            
        except Exception as e:
            print(f"❌ Error updating artwork text via lightbox: {e}")
            return jsonify({
                'success': False,
                'message': f'Failed to update artwork: {str(e)}'
            }), 500
    
    @app.route('/api/artwork/<int:artwork_id>/info', methods=['GET'])  
    def get_artwork_info(artwork_id):
        """
        Get basic artwork information (title, description)
        Used for refreshing lightbox data after updates
        """
        try:
            conn = get_db_connection()
            artwork = conn.execute(
                'SELECT id, title, description, image_path FROM artworks WHERE id = ?',
                (artwork_id,)
            ).fetchone()
            conn.close()
            
            if not artwork:
                return jsonify({
                    'success': False,
                    'message': 'Artwork not found'
                }), 404
            
            return jsonify({
                'success': True,
                'artwork': {
                    'id': artwork['id'],
                    'title': artwork['title'],
                    'description': artwork['description'],
                    'image_path': artwork['image_path']
                }
            })
            
        except Exception as e:
            print(f"❌ Error fetching artwork info: {e}")
            return jsonify({
                'success': False,
                'message': f'Failed to fetch artwork: {str(e)}'
            }), 500

    @app.route('/api/extract-metadata', methods=['POST'])
    def extract_metadata_api():
        """
        Extract metadata from uploaded image without saving to database
        """
        try:
            if 'image' not in request.files:
                return jsonify({'success': False, 'message': 'No image provided'}), 400
            
            file = request.files['image']
            if file.filename == '':
                return jsonify({'success': False, 'message': 'No image selected'}), 400
            
            # Validate file
            validation_result = validate_image_file(file)
            if not validation_result['valid']:
                return jsonify({'success': False, 'message': validation_result['message']}), 400
            
            # Save temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
                file.save(tmp_file.name)
                temp_path = tmp_file.name
            
            try:
                # Extract all metadata
                metadata = {
                    'ai_generation': {},
                    'exif': {},
                    'gps': {},
                    'file_info': {},
                    'other': {}
                }
                
                # Open image with proper error handling
                try:
                    img = Image.open(temp_path)
                except Exception as e:
                    return jsonify({
                        'success': False,
                        'message': f'Cannot open image file: {str(e)}'
                    }), 400
                
                # File info
                try:
                    file_size = os.path.getsize(temp_path)
                    metadata['file_info'] = {
                        'filename': file.filename,
                        'size': f"{file_size / 1024:.1f} KB",
                        'format': img.format or 'Unknown',
                        'dimensions': f"{img.width} × {img.height}",
                        'color_mode': img.mode,
                        'has_transparency': img.mode in ('RGBA', 'LA', 'P') and 'transparency' in img.info
                    }
                except Exception as e:
                    print(f"⚠️ Error getting file info: {e}")
                    metadata['file_info'] = {'filename': file.filename}
                
                # Extract AI metadata using existing function
                try:
                    ai_metadata = extract_ai_metadata_detailed(temp_path)
                    if ai_metadata:
                        metadata['ai_generation'] = ai_metadata
                except Exception as e:
                    print(f"⚠️ Error extracting AI metadata: {e}")
                
                # Extract EXIF data
                try:
                    exif_data = {}
                    if hasattr(img, '_getexif') and img._getexif():
                        exif = img._getexif()
                        for tag_id, value in exif.items():
                            tag = TAGS.get(tag_id, tag_id)
                            
                            # Skip GPS data (handled separately)
                            if tag == 'GPSInfo':
                                continue
                            
                            # Format value
                            if isinstance(value, bytes):
                                try:
                                    value = value.decode('utf-8', errors='ignore')
                                except:
                                    value = str(value)
                            
                            exif_data[tag] = str(value)
                        
                        if exif_data:
                            metadata['exif'] = exif_data
                except Exception as e:
                    print(f"⚠️ Error extracting EXIF: {e}")
                
                # Extract GPS data
                try:
                    if hasattr(img, '_getexif') and img._getexif():
                        exif = img._getexif()
                        if exif and 34853 in exif:  # GPSInfo tag
                            gps_info = exif[34853]
                            gps_data = {}
                            
                            for key in gps_info.keys():
                                decode = GPSTAGS.get(key, key)
                                gps_data[decode] = gps_info[key]
                            
                            # Convert to decimal degrees if possible
                            if 'GPSLatitude' in gps_data and 'GPSLongitude' in gps_data:
                                lat = gps_data['GPSLatitude']
                                lon = gps_data['GPSLongitude']
                                
                                # Convert to decimal
                                if isinstance(lat, tuple) and len(lat) == 3:
                                    lat_decimal = lat[0] + lat[1]/60 + lat[2]/3600
                                    if gps_data.get('GPSLatitudeRef') == 'S':
                                        lat_decimal = -lat_decimal
                                    metadata['gps']['latitude'] = f"{lat_decimal:.6f}"
                                
                                if isinstance(lon, tuple) and len(lon) == 3:
                                    lon_decimal = lon[0] + lon[1]/60 + lon[2]/3600
                                    if gps_data.get('GPSLongitudeRef') == 'W':
                                        lon_decimal = -lon_decimal
                                    metadata['gps']['longitude'] = f"{lon_decimal:.6f}"
                            
                            if 'GPSAltitude' in gps_data:
                                metadata['gps']['altitude'] = f"{gps_data['GPSAltitude']} m"
                            
                            if 'GPSTimeStamp' in gps_data:
                                metadata['gps']['timestamp'] = str(gps_data['GPSTimeStamp'])
                except Exception as e:
                    print(f"⚠️ Error extracting GPS: {e}")
                
                # Extract PNG metadata
                try:
                    if img.format == 'PNG' and hasattr(img, 'info'):
                        for key, value in img.info.items():
                            if key not in ['parameters', 'prompt', 'negative_prompt']:  # Skip AI metadata
                                try:
                                    if isinstance(value, bytes):
                                        value = value.decode('utf-8', errors='ignore')
                                    metadata['other'][key] = str(value)
                                except:
                                    pass
                except Exception as e:
                    print(f"⚠️ Error extracting PNG metadata: {e}")
                
                # Clean up empty sections
                metadata = {k: v for k, v in metadata.items() if v}
                
                print(f"✅ Metadata extracted successfully for {file.filename}")
                return jsonify({
                    'success': True,
                    'metadata': metadata
                })
                
            finally:
                # Clean up temp file
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                except Exception as e:
                    print(f"⚠️ Error cleaning up temp file: {e}")
            
        except Exception as e:
            print(f"❌ Metadata extraction error: {e}")
            traceback.print_exc()  # Print full stack trace for debugging
            return jsonify({
                'success': False,
                'message': f'Failed to extract metadata: {str(e)}'
            }), 500

# =============================================================================
# 🛣️ MAIN ROUTES SECTION
# =============================================================================
def register_routes(app):
    """Register main application routes"""
    
    @app.route('/')
    def index():
        conn = get_db_connection()
        artworks = conn.execute('SELECT * FROM artworks ORDER BY position DESC').fetchall()
        conn.close()
        
        # Process artworks để thêm thumbnail path
        processed_artworks = []
        for artwork in artworks:
            art_dict = dict(artwork)
            filename = art_dict['image_path'].split('/')[-1]
            art_dict['thumbnail_path'] = f"/thumbnail/{filename}"
            processed_artworks.append(art_dict)
            
        return render_template('index.html', artworks=processed_artworks)

    @app.route('/thumbnail/<path:filename>')
    def serve_thumbnail(filename):
        """Serve thumbnail, create if not exists"""
        thumb_path = f"static/thumbnails/{filename}"
        original_path = f"static/uploads/{filename}"
        
        if not os.path.exists(thumb_path) and os.path.exists(original_path):
            create_thumbnail_with_metadata(original_path)
            
        if os.path.exists(thumb_path):
            return send_file(thumb_path)
        else:
            return send_file(original_path)

    @app.route('/add', methods=['POST'])
    def add_artwork():
        try:
            if 'image' not in request.files:
                return jsonify({'success': False, 'message': 'No image selected'}), 400
                
            file = request.files['image']
            if file.filename == '':
                return jsonify({'success': False, 'message': 'No image selected'}), 400
                
            # Validate file
            validation_result = validate_image_file(file)
            if not validation_result['valid']:
                return jsonify({'success': False, 'message': validation_result['message']}), 400
                
            filename = file.filename
            ext = filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{uuid.uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
            
            # Process and save file with metadata preservation
            if ext != 'svg':
                optimized = optimize_image_with_metadata(file)
                with open(file_path, 'wb') as f:
                    f.write(optimized.read())
            else:
                file.save(file_path)
            
            # Create thumbnail with metadata
            create_thumbnail_with_metadata(file_path)
            
            title = request.form.get('title', '').strip()
            description = request.form.get('description', '').strip()
            if not description:
                description = "No description provided"
            
            conn = get_db_connection()
            max_pos = conn.execute('SELECT MAX(position) FROM artworks').fetchone()[0] or 0
            new_pos = max_pos + 1
            
            # Get the new artwork ID and return artwork data
            cursor = conn.execute(
                'INSERT INTO artworks (title, description, image_path, position) VALUES (?, ?, ?, ?)',
                (title if title else None, description, f"static/uploads/{unique_filename}", new_pos)
            )
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            # Return complete artwork data for frontend animation
            artwork_data = {
                'id': new_id,
                'title': title if title else None,
                'description': description,
                'image_path': f"static/uploads/{unique_filename}",
                'thumbnail_path': f"/thumbnail/{unique_filename}",
                'position': new_pos
            }
            
            print(f"✅ Artwork added with metadata preserved: {unique_filename}")
            
            return jsonify({
                'success': True,
                'message': 'Artwork added successfully!',
                'artwork': artwork_data,
                'redirect': url_for('index')
            })
            
        except Exception as e:
            print(f"❌ Error adding artwork: {e}")
            if 'file_path' in locals() and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            return jsonify({'success': False, 'message': f'Failed to add artwork: {str(e)}'}), 500

    @app.route('/edit/<int:id>', methods=['POST'])
    def edit_artwork(id):
        try:
            title = request.form.get('title', '').strip()
            description = request.form.get('description', '').strip()
            if not description:
                description = "No description provided"
            
            conn = get_db_connection()
            artwork = conn.execute('SELECT * FROM artworks WHERE id = ?', (id,)).fetchone()
            
            if not artwork:
                return jsonify({'success': False, 'message': 'Artwork not found'}), 404
            
            new_image_path = None
            new_unique_filename = None
            
            if 'image' in request.files and request.files['image'].filename != '':
                file = request.files['image']
                
                validation_result = validate_image_file(file)
                if not validation_result['valid']:
                    return jsonify({'success': False, 'message': validation_result['message']}), 400
                
                filename = file.filename
                ext = filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{uuid.uuid4()}.{ext}"
                new_unique_filename = unique_filename
                file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
                
                # Process with metadata preservation
                if ext != 'svg':
                    optimized = optimize_image_with_metadata(file)
                    with open(file_path, 'wb') as f:
                        f.write(optimized.read())
                else:
                    file.save(file_path)
                    
                create_thumbnail_with_metadata(file_path)
                new_image_path = f"static/uploads/{unique_filename}"
                
                # Cleanup old files
                old_image = artwork['image_path']
                cleanup_old_files(old_image)
                
                conn.execute(
                    'UPDATE artworks SET title = ?, description = ?, image_path = ? WHERE id = ?',
                    (title if title else None, description, new_image_path, id)
                )
                
                print(f"✅ Artwork updated with metadata preserved: {unique_filename}")
            else:
                conn.execute(
                    'UPDATE artworks SET title = ?, description = ? WHERE id = ?',
                    (title if title else None, description, id)
                )
                print(f"✅ Artwork metadata updated: {id}")
            
            conn.commit()
            conn.close()
            
            # Return updated artwork data
            artwork_data = {
                'id': id,
                'title': title if title else None,
                'description': description,
                'image_path': new_image_path if new_image_path else artwork['image_path'],
                'thumbnail_path': f"/thumbnail/{new_unique_filename}" if new_unique_filename else f"/thumbnail/{artwork['image_path'].split('/')[-1]}",
                'position': artwork['position']
            }
            
            return jsonify({
                'success': True,
                'message': 'Artwork updated successfully!',
                'artwork': artwork_data,
                'redirect': url_for('index')
            })
            
        except Exception as e:
            print(f"❌ Error updating artwork: {e}")
            if 'file_path' in locals() and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            return jsonify({'success': False, 'message': f'Failed to update artwork: {str(e)}'}), 500

    @app.route('/delete/<int:id>', methods=['POST'])
    def delete_artwork(id):
        try:
            conn = get_db_connection()
            artwork = conn.execute('SELECT * FROM artworks WHERE id = ?', (id,)).fetchone()
            
            if not artwork:
                return jsonify({'success': False, 'message': 'Artwork not found'}), 404
            
            img_path = artwork['image_path']
            cleanup_old_files(img_path)
            
            conn.execute('DELETE FROM artworks WHERE id = ?', (id,))
            conn.commit()
            conn.close()
            
            print(f"✅ Artwork deleted: {id}")
            
            return jsonify({
                'success': True,
                'message': 'Artwork deleted successfully!'
            })
            
        except Exception as e:
            print(f"❌ Error deleting artwork: {e}")
            return jsonify({'success': False, 'message': f'Failed to delete artwork: {str(e)}'}), 500

    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        return render_template('error.html', 
                             error_code=404, 
                             error_message='Resource not found'), 404

    @app.errorhandler(500)
    def internal_error(error):
        return render_template('error.html', 
                             error_code=500, 
                             error_message='Internal server error occurred'), 500

# =============================================================================
# 🔧 MIDDLEWARE SECTION
# =============================================================================
def register_patch_middleware(app):
    """
    Add middleware to handle PATCH request errors gracefully
    """
    
    @app.errorhandler(400)
    def bad_request(error):
        if request.method == 'PATCH':
            return jsonify({
                'success': False,
                'message': 'Bad request: Invalid data format'
            }), 400
        # Return original error for non-PATCH requests
        return error
    
    @app.errorhandler(404) 
    def not_found(error):
        if request.method == 'PATCH':
            return jsonify({
                'success': False,
                'message': 'Resource not found'
            }), 404
        # Return original error for non-PATCH requests  
        return error
    
    @app.errorhandler(500)
    def internal_error(error):
        if request.method == 'PATCH':
            return jsonify({
                'success': False,
                'message': 'Internal server error'
            }), 500
        # Return original error for non-PATCH requests
        return error

# =============================================================================
# 🚀 APPLICATION INITIALIZATION SECTION
# =============================================================================
def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    app.secret_key = SECRET_KEY

    # Ensure directories exist
    ensure_directories()

    # Register all routes and middleware
    register_routes(app)
    register_api_routes(app)
    register_lightbox_api_routes(app)
    register_patch_middleware(app)

    # Security headers
    @app.after_request
    def after_request(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        
        # Add CORS headers for PATCH requests
        if request.method == 'PATCH':
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        
        return response

    # Add OPTIONS handler for PATCH preflight requests
    @app.route('/api/artwork/<int:artwork_id>/update-text', methods=['OPTIONS'])
    def artwork_update_text_preflight(artwork_id):
        """Handle preflight requests for PATCH"""
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Methods'] = 'PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    return app

# =============================================================================
# 🎯 MAIN EXECUTION SECTION
# =============================================================================
if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Generate thumbnails for existing images
    ensure_thumbnails_exist()
    
    # Create Flask application
    app = create_app()
    
    # Startup messages
    print("=" * 60)
    print("🎨 ART GALLERY - COMPLETE MERGED APPLICATION")
    print("=" * 60)
    print("✅ Database initialized")
    print("✅ Directories ensured")
    print("✅ Standard routes registered")
    print("✅ API routes registered") 
    print("✅ Lightbox API routes registered")
    print("✅ Metadata API with FIXED error handling enabled")
    print("✅ Metadata Viewer API enabled")
    print("✅ Enhanced error handling enabled")
    print("✅ Thumbnails generated for existing images")
    print("🚀 Ready for inline editing in lightbox!")
    print("=" * 60)
    
    # Run the application
    app.run(debug=True, host='0.0.0.0', port=5000)

# =============================================================================
# 📝 END OF FILE
# =============================================================================