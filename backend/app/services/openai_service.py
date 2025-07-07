# backend/app/services/openai_service.py
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=api_key)

def get_openai_response(user_input: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_input}
        ]
    )
    return response.choices[0].message.content

# add the image generation function
def generate_image(prompt: str) -> str:
    response = client.images.generate(
        model="dall-e-3",  # or "dall-e-2" if you're limited
        prompt=prompt,
        n=1,
        size="1024x1024"
    )
    return response.data[0].url
