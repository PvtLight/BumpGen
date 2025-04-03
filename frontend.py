import base64
from PIL import Image as PILImage
import streamlit as st
import io
import tempfile
import os
import json
import re
import requests
from google.oauth2 import service_account
from google.cloud import aiplatform
from dotenv import load_dotenv

load_dotenv()
# Initialize the Vertex AI Endpoint
ENDPOINT = aiplatform.Endpoint(
    endpoint_name=os.environ['ENDPOINT_NAME']
)
MAX_TOKENS = 250
TEMPERATURE = 1
TOP_P = 0.95
MAX_RETRIES = 3  # Set max retries in case of insufficient captions

def predict(instances):
    """Send prediction request to the endpoint."""
    response = ENDPOINT.predict(instances=instances)
    if response.predictions:
        return response.predictions
    else:
        return response
    
def extract_captions(response_text):
    response_lines = response_text.strip().split("\n")
    captions = []

    for line in response_lines:
        line = line.strip()

        # Check if the line starts with a numbered emoji or digit (caption format)
        if any(line.startswith(str(i)) for i in range(1, 10)) or line.startswith("10") or line.startswith("🔟"):
            if any(line.startswith(emoji) for emoji in ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']):
                parts = line.split(" ", 1)
                if len(parts) > 1:
                    captions.append(parts[1])
            elif line[0].isdigit():
                match = re.search(r"^(\d+[\.:]?\s+)", line)
                if match:
                    captions.append(line[match.end():])
            else:
                captions.append(line)
        elif len(re.findall(r'\b\w+\b', line)) > 3:  # If it's a valid caption (more than 3 words)
            captions.append(line)
    
    return captions


# Set page config to wide mode
st.set_page_config(layout="wide")

# Detect mobile devices
def is_mobile():
    try:
        import user_agents
        user_agent = st.get_user_agent()
        return user_agents.parse(user_agent).is_mobile
    except:
        # Fallback to viewport width detection
        return False

# Initialize session state for mobile view
if 'mobile_view' not in st.session_state:
    st.session_state.mobile_view = is_mobile()

# Custom CSS for responsive design
st.markdown("""
    <style>
    .stApp {
        max-width: 100%;
        padding: 1rem;
    }
    
    /* Center title */
    .title-container {
        text-align: center;
        padding: 1rem 0;
        margin-bottom: 2rem;
    }
    .title-container h1 {
        font-size: 2.5rem;
        font-weight: bold;
        color: #262730 !important;
    }
    
    /* Card styles with dark mode support */
    .header-card {
        background-color: #f0f2f6 !important;
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
    .header-card h3 {
        color: #262730 !important;
        margin: 0;
    }
    
    .content-card {
        background-color: #ffffff !important;
        padding: 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        color: #262730 !important;
    }
    
    .content-card .description {
        font-weight: bold;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e0e0e0;
    }
    
    .content-card .reply {
        padding: 0.5rem 0;
        margin: 0.25rem 0;
    }
    
    /* Responsive container */
    @media (max-width: 640px) {
        .main > div {
            padding: 0;
        }
        .stTextArea > div > textarea {
            font-size: 16px; /* Prevent zoom on mobile */
        }
    }
    
    /* Custom container for results */
    .results-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }
    
    @media (min-width: 641px) {
        .results-container {
            flex-direction: row;
            flex-wrap: wrap;
        }
    }

    /* Dark mode overrides */
    @media (prefers-color-scheme: dark) {
        .title-container h1 {
            color: #ffffff !important;
        }
        .header-card {
            background-color: #2e2e2e !important;
        }
        .header-card h3 {
            color: #ffffff !important;
        }
        .content-card {
            background-color: #1e1e1e !important;
            color: #ffffff !important;
        }
        
        .content-card .description {
            border-bottom-color: #404040;
        }
    }
    </style>
""", unsafe_allow_html=True)

def parse_llm_response(response):
    """
    Parses the LLM-generated response to extract exactly 10 captions, handling both structured and unstructured formats.
    """

    if "Output" in response[0]:
        response_text = response[0].split("Output", 1)[-1]
        return response_text
    else:
        response_text = response
        
        # Split by newlines and strip spaces
        lines = [line.strip() for line in response_text.split("\n") if line.strip()]
        print('response_text in else',response)
        # Try extracting structured captions (1️⃣, 2️⃣, etc.)
        structured_captions = re.findall(r'(\d️⃣|🔟)\s+(.+)', response_text)

        if structured_captions:
            # If structured format is found, return the cleaned captions
            captions = [f"{num} {text}" for num, text in structured_captions]
        else:
            # If unstructured format, filter out empty lines and emojis at the end
            cleaned_lines = [line for line in lines if not re.fullmatch(r"[^\w]+", line)]
            
            # Ensure we get only 10 captions
            captions = cleaned_lines[:10]

        return captions


# Streamlit app
st.markdown('<div class="title-container"><h1>Bump Gen AI</h1></div>', unsafe_allow_html=True)

# Create a container with custom width for the form
form_container = st.container()
with form_container:
    # Responsive columns - adjust ratios for different screen sizes
    if st.session_state.get('mobile_view', False):
        form_col = st.columns([1])[0]  # Full width on mobile
    else:
        _, form_col, _ = st.columns([1, 2, 1])  # Centered on desktop
    
    with form_col:
        st.text("Enter image URLs (one per line or separated by commas) and provide a prompt for reply generation")

        # Single textbox for multiple URLs
        urls_input = st.text_area("Image URLs", 
                                help="Enter multiple image URLs (one per line or separated by commas). Maximum 8 images allowed.")

        # Text input for prompt
        user_prompt = st.text_area("Enter your prompt here", "")
        
        # Submit button
        generate_button = st.button("Generate Replies")

# Process URLs
urls = []
if urls_input:
    # Split by both newlines and commas, then clean up
    raw_urls = [url.strip() for url in urls_input.replace(',', '\n').split('\n')]
    urls = [url for url in raw_urls if url]  # Remove empty strings

# Limit to 8 URLs
if len(urls) > 8:
    st.warning("Maximum 8 images allowed. Only the first 8 will be processed.")
    urls = urls[:8]

# Placeholder for image inputs
image_inputs = []
temp_file_paths = []
images = []  # Store PIL images for reuse

if urls:
    # Create a container for preview images with the same width as the form
    preview_container = st.container()
    with preview_container:
        # Use the same column layout as the form
        if st.session_state.get('mobile_view', False):
            preview_col = st.columns([1])[0]  # Full width on mobile
        else:
            _, preview_col, _ = st.columns([1, 2, 1])  # Centered on desktop
        
        with preview_col:
            st.markdown("<h3>Preview Images</h3>", unsafe_allow_html=True)
            # Create columns for displaying images
            cols = st.columns(min(3, len(urls)))  # Changed back to 3 columns
            
            for idx, url in enumerate(urls):
                try:
                    # Download image from URL
                    response = requests.get(url)
                    if response.status_code == 200:
                        # Create temporary file
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
                            temp_file.write(response.content)
                            temp_file_path = temp_file.name
                            temp_file_paths.append(temp_file_path)
                            
                            # Display image in a column
                            with cols[idx % 3]:  # Changed back to 3
                                image = PILImage.open(io.BytesIO(response.content))
                                images.append(image.copy())  # Store a copy of the image
                                st.image(image, caption=f"Image {idx + 1}", use_column_width=True)
                                
                                # Convert image to base64
                                if image.mode in ("RGBA", "LA"):
                                    image = image.convert("RGB")
                                image.thumbnail((300, 300))  # Resize to reduce size
                                buffer = io.BytesIO()
                                image.save(buffer, format="JPEG", quality=50)  # Compress and save as JPEG
                                buffer.seek(0)
                                encoded_image = base64.b64encode(buffer.read()).decode("utf-8")
                                image_inputs.append(url)

                    else:
                        st.error(f"Failed to load image from URL {idx + 1}")
                except Exception as e:
                    st.error(f"Error processing image {idx + 1}: {str(e)}")

# Submit button
if generate_button:
    if user_prompt or image_inputs:  # Allow generation with either prompt or images
        try:

            
            # Process images in groups of 3 (or 1 on mobile)
            group_size = 1 if st.session_state.get('mobile_view', False) else 3  # Changed back to 3
            for i in range(0, len(image_inputs), group_size):
                # Create columns for displaying results
                result_cols = st.columns(group_size)
                
                # Process images in the current group
                for j in range(group_size):
                    if i + j < len(image_inputs):
                        with result_cols[j]:
                            idx = i + j
                            st.markdown(
                                f"<div style='background-color: #f0f2f6; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;'><h3>Generated Reply for Image {idx + 1}</h3></div>",
                                unsafe_allow_html=True
                            )
                            
                            # Display the image with responsive width
                            st.image(images[idx], use_column_width=True)
                            
                            # Send the inputs to the model
                            prompt =  '''
                                Generate exactly **10** witty, suggestive, and humorous captions based on the given image.  
                                Each caption must be a **short, clever one-liner** with a **playful** and **humorous** tone.  

                                ⚠️ **Only 10 captions. Do NOT exceed this limit.**  

                                Format the response as follows, including emojis:  
                                1️⃣ [first caption]
                                2️⃣ [second caption]
                                3️⃣ [third caption]
                                4️⃣ [fourth caption]
                                5️⃣ [fifth caption]
                                6️⃣ [sixth caption]
                                7️⃣ [seventh caption]
                                8️⃣ [eighth caption]
                                9️⃣ [ninth caption]
                                🔟 [tenth caption]""")
                            '''

                            if user_prompt:
                                prompt += user_prompt
                            
                            instances = [
                                    {
                                        "prompt": prompt,
                                        "multi_modal_data": {"image": image_inputs[idx]},
                                        "max_tokens": MAX_TOKENS,
                                        "temperature": TEMPERATURE,
                                        "top_p": TOP_P,
                                    },
                                ]
                            
                            # Retry loop to ensure at least 5 captions are generated
                            retry_count = 0
                            captions = []

                            while retry_count < MAX_RETRIES:
                                response = predict(instances)
                                response_text = parse_llm_response(response)

                                captions = extract_captions(response_text)
                                
                                if len(captions) >= 6:
                                    break  # Stop retrying if at least 5 captions are found

                                retry_count += 1  # Increment retry counter

                            # Ensure there are always 10 captions, adding empty ones at the end
                            captions.extend([""] * (10 - len(captions)))

                            # Define fixed height for each caption block
                            fixed_height = "50px"  # Adjust as needed

                            # Display Captions
                            for caption_text in captions:
                                if caption_text.strip():  
                                    st.code(caption_text, language=None)
                                else:  
                                    st.markdown(
                                        f"<div style='min-height: {fixed_height}; background-color: #2b2b2b; border-radius: 5px; padding: 8px;'>&nbsp;</div>",
                                        unsafe_allow_html=True
                                    )

                            # Add global script to modify clipboard behavior when copying
                            st.markdown("""
                            <script>
                            document.addEventListener('copy', function(e) {
                                const selection = window.getSelection();
                                const text = selection.toString();
                                
                                // Check if the text starts with a number or emoji number
                                if (/^[0-9️⃣🔟]/.test(text)) {
                                    // Remove the number prefix
                                    const modifiedText = text.replace(/^[0-9️⃣🔟]+[\s\.]+/, '');
                                    
                                    // Set the modified text in the clipboard
                                    e.clipboardData.setData('text/plain', modifiedText);
                                    e.preventDefault();
                                }
                            });
                            </script>
                            """, unsafe_allow_html=True)

            # Clean up temporary files
            for temp_file_path in temp_file_paths:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                    
        except Exception as e:
            st.error(f"An error occurred: {e}")
    else:
        st.warning("Please enter a prompt or provide image URLs before generating replies.")