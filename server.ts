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
        description: "If layout is 'custom-html', this MUST contain raw, complete, self-contained HTML (using Tailwind classes) representing the UI. You MUST incorporate the scene's 'text' (the spoken script) prominently into this HTML design so it is readable on-screen!"
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
    required: ["id", "text", "duration", "animationType", "keywords", "layout", "customHtml", "themeConfig"]
  }
};

app.post('/api/editor', async (req, res) => {
  try {
    const { script, visualStyle, aspectRatio, referenceImages, assetImages, assetLinks } = req.body;
    
    const parts: any[] = [];
    
    // Map full dataURLs to short asset URIs to prevent token explosion.
    const assetMap = new Map<string, string>();
    let assetDescriptions = '';
    
    if (assetImages && assetImages.length > 0) {
      assetDescriptions += "\n\nAvailable Story Assets (use their EXACT short urls in layoutData.url when appropriate):\n";
      assetImages.forEach((img: any, idx: number) => {
        const shortUrl = `asset://${idx}`;
        assetMap.set(shortUrl, img.url);
        assetDescriptions += `Image ${idx + 1}. Description: "${img.description}" | URL: "${shortUrl}"\n`;
        
        // Let's also attach them as images to the prompt so the AI can see them.
        const match = img.url.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
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

    if (assetLinks && assetLinks.length > 0) {
      assetDescriptions += "\n\nAvailable Story Website Links to animate/copy:\n";
      for (let i = 0; i < assetLinks.length; i++) {
        try {
            const linkUrl = assetLinks[i].url;
            // Fetch basic HTML content safely
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const fetchRes = await fetch(linkUrl.startsWith('http') ? linkUrl : 'https://' + linkUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }).catch(() => null);
            clearTimeout(timeoutId);
            
            let fetchedData = '';
            if (fetchRes && fetchRes.ok) {
                const html = await fetchRes.text();
                const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const title = titleMatch ? titleMatch[1] : '';
                let bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                let bodyText = bodyMatch ? bodyMatch[1] : html;
                const textContent = bodyText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 1000);
                fetchedData = `Site Title: ${title.trim()} | Excerpt: ${textContent.trim()}`;
            } else {
                fetchedData = `URL: ${linkUrl} (Could not fetch excerpt, simulate based on domain name)`;
            }
            assetDescriptions += `Link ${i + 1}. Description: "${assetLinks[i].description}" | Content: ${fetchedData}\n`;
        } catch (e) {
            console.error('Fetch error:', e);
        }
      }
    }

    const prompt = `You are an expert AI video editor and frontend UI developer.
Analyze the following script and visual style.
Break the script down into a sequence of scenes.

Script: "${script}"
Style requested: ${visualStyle}
Aspect ratio: ${aspectRatio}${assetDescriptions}

CRITICAL INSTRUCTIONS TO PREVENT TRUNCATION & ENSURE VARIETY:
1. MAX SCENES: Limit the total output to MAXIMUM 5 SCENES by grouping the script into larger chunks. Do not make a new scene for every short phrase.
2. ALWAYS USE CUSTOM UI: YOU MUST use the 'custom-html' layout for EVERY scene. Do not use the generic built-in templates. Instead, generate a completely unique, fresh UI structure using raw HTML and Tailwind CSS for every single scene.
3. SCENE VARIETY: Each scene must look entirely different from the last. Build custom dashboards, creative typographic layouts, unique charts, dynamic cards, glassmorphic panels, and abstract shapes using Tailwind. Include motion and animations by utilizing CSS animations via inline styles or Tailwind classes (e.g. animate-pulse, animate-bounce, or custom inline style animations).
4. READABILITY: You MUST visibly include the scene's 'text' (the spoken script) within the \`customHtml\` design! Do not generate empty decorative UI. The user's script must prominently fit into the layout you create.
5. STORY ASSETS (IMAGES & LINKS): 
   - If an Image Asset is provided, use it inside your 'custom-html' template using \`<img src="[URL]" />\`.
   - If a Website Link Asset is provided, generate a beautifully animated UI mockup of that website based on the Content Excerpts.
6. Extract exact color palettes from reference images if provided (backgroundColor, cardColor, primaryColor, secondaryColor, textColor). The 'textColor' MUST contrast with 'backgroundColor'.
7. Match durations to reading speed (about 1s per 3 words). Minimum 3000ms per scene.`;

    parts.push({ text: prompt });

    if (referenceImages && referenceImages.length > 0) {
      parts.push({ text: "Reference Images for Visual Style:" });
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
          model: "gemini-2.5-flash",
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
      // Restore the full data URls for the parsed scenes
      parsedScenes.forEach((scene: any) => {
         if (scene.layoutData && scene.layoutData.url && assetMap.has(scene.layoutData.url)) {
            scene.layoutData.url = assetMap.get(scene.layoutData.url);
         }
      });
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

  app.post('/api/render-video', async (req, res) => {
  try {
    const { scenes, aspectRatio } = req.body;

    // Simulate the time it would take to bootstrap a headless browser
    await new Promise(r => setTimeout(r, 3000));
    
    // In a full production environment, we would use Puppeteer/Playwright + FFmpeg here
    // to step through the animations and capture frames.
    // However, the AI Studio preview container lacks the necessary Linux system libraries 
    // for libnss3, Xvfb, and FFmpeg required for video encoding.

    throw new Error("SERVER_ENV_CONSTRAINT: Server-side video rendering requires FFmpeg and Headless Chromium. These system-level dependencies are not available in this lightweight preview sandbox. To enable fully automated background rendering, please deploy this codebase to a dedicated server or container registry that supports these tools (e.g., Google Cloud Run with a custom Dockerfile installing ffmpeg/chromium).");
    
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
