import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const sceneSchema: Schema = {
  type: Type.ARRAY,
  description: "List of scenes",
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING, description: "The spoken script chunk mapped to this scene. Max 10-15 words." },
      duration: { type: Type.INTEGER, description: "Pacing duration in milliseconds (e.g., 3000 to 5000)" },
      animationType: { 
        type: Type.STRING, 
        enum: ['fade', 'slide-up', 'scale', 'typewriter', 'blur-in'],
        description: "Entry text animation"
      },
      keywords: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "1-2 keywords to highlight" 
      },
      layout: {
        type: Type.STRING,
        enum: ['text-only', 'counter', 'phone', 'image-card', 'browser', 'tabs', 'button-click', 'search-bar', 'profile-card', 'code-editor', 'custom-html']
      },
      layoutData: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          start: { type: Type.INTEGER, nullable: true },
          end: { type: Type.INTEGER, nullable: true },
          prefix: { type: Type.STRING, nullable: true },
          url: { type: Type.STRING, nullable: true }
        }
      },
      customHtml: {
        type: Type.STRING,
        nullable: true,
        description: "If layout is 'custom-html', this must contain raw, complete, self-contained HTML using Tailwind CSS classes to render a unique UI motion graphic from scratch. It must not have external dependencies. Ensure high quality design."
      },
      themeConfig: {
        type: Type.OBJECT,
        description: "Dynamic colors applied to THIS specific scene, tailored to match the visual style requested. Vary these between scenes if visualStyle requests dynamic motion UI.",
        properties: {
          backgroundColor: { type: Type.STRING, description: "Hex config e.g. '#000000'" },
          primaryColor: { type: Type.STRING, description: "Hex e.g. '#FF5A00'" },
          secondaryColor: { type: Type.STRING, description: "Hex e.g. '#262626'" },
          textColor: { type: Type.STRING, description: "Hex e.g. '#FFFFFF'" },
          cardColor: { type: Type.STRING, description: "Hex e.g. '#171717'" },
          borderRadius: { type: Type.STRING, description: "Tailwind string like '0.5rem', '1rem', '2rem', '9999px'" },
        },
        required: ["backgroundColor", "primaryColor", "secondaryColor", "textColor", "cardColor", "borderRadius"]
      }
    },
    required: ["id", "text", "duration", "animationType", "keywords", "layout", "themeConfig"]
  }
};

app.post('/api/editor', async (req, res) => {
  try {
    const { script, visualStyle, aspectRatio, referenceImages } = req.body;
    
    const parts: any[] = [];
    
    const prompt = `You are an expert AI video editor and frontend UI developer.
Analyze the following script and visual style.
Break the script down into a sequence of scenes.

Script: "${script}"
Style requested: ${visualStyle}
Aspect ratio: ${aspectRatio}

CRITICAL INSTRUCTIONS TO PREVENT TRUNCATION:
1. MAX SCENES: Limit the total output to MAXIMUM 5 SCENES by grouping the script into larger chunks. Do not make a new scene for every short phrase.
2. PREFER BUILT-IN LAYOUTS: Strongly prefer using the built-in layouts ('search-bar', 'browser', 'phone', 'profile-card', 'text-only', 'counter') instead of 'custom-html'. This saves output tokens.
3. If you MUST use 'custom-html', keep it EXTREMELY CONCISE. Max 300 characters. No complex HTML or SVG paths. Focus on simple div shapes and flex structures.
4. Extract exact color palettes from reference images if provided (backgroundColor, cardColor, primaryColor, secondaryColor, textColor). The 'textColor' MUST contrast with 'backgroundColor'.
5. Match durations to reading speed (about 1s per 3 words). Minimum 3000ms per scene.`;

    parts.push({ text: prompt });

    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach((imgUrl: string) => {
        const match = imgUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      });
    }

    let response;
    let retries = 3;
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: parts,
          config: {
            responseMimeType: "application/json",
            responseSchema: sceneSchema,
            maxOutputTokens: 8192
          }
        });
        break;
      } catch (err: any) {
        retries--;
        const isUnavailable = err.status === 503 || err.status === 429 || (err.message && err.message.includes('503'));
        if (isUnavailable && retries > 0) {
          console.log(`Gemini API busy (503/429), retrying in 2s... (\${retries} retries left)`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
    }

    const body = response?.text;
    if (!body) throw new Error("Empty response");

    let parsedScenes;
    try {
      parsedScenes = JSON.parse(body);
    } catch (parseErr) {
      console.error("JSON parse failed. Possibly truncated:", parseErr);
      throw new Error("The AI response was too large and got cut off in the middle of generating. Please try reducing the length of your script.");
    }

    res.json({ scenes: parsedScenes });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
