require('dotenv').config();
const OpenAI = require('openai');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const mammoth = require('mammoth');
const fs = require('fs');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const s3 = new S3Client({ region: 'us-east-1' });

class ConnecTraAIAgent {
  constructor(sessionId, pptUrl, voice = 'alloy') {
    this.sessionId = sessionId;
    this.pptUrl = pptUrl;
    this.voice = voice; // 'alloy' male, 'nova' female
    this.knowledgeBase = [];
  }

  async init() {
    console.log(`🤖 ConnecTra AI Agent initializing for session ${this.sessionId}`);
    await this.extractPPTContent();
  }

  async extractPPTContent() {
    try {
      // Download PPT from S3
      const pptData = await s3.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: this.pptUrl.split('.com/')[1]
      }));
      
      const pptBuffer = Buffer.from(await pptData.Body.transformToByteArray());
      fs.writeFileSync('temp.pptx', pptBuffer);
      
      // Extract text using mammoth
      const result = await mammoth.extractRawText({ path: 'temp.pptx' });
      this.knowledgeBase = result.value.split('\n\n').filter(slide => slide.trim());
      
      console.log(`📄 ConnecTra AI loaded ${this.knowledgeBase.length} slides`);
    } catch (err) {
      console.error('ConnecTra AI PPT extraction failed:', err);
    }
  }

  async processQuestion(audioData) {
    try {
      // Whisper STT
      const transcript = await openai.audio.transcriptions.create({
        file: new File([audioData], 'question.webm', { type: 'audio/webm' }),
        model: 'whisper-1'
      });

      // GPT-4o with PPT context
      const context = this.knowledgeBase.slice(0, 5).join('\n');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are ConnecTra AI, a professional company representative. 
            Use formal business language. Reference the presentation slides when relevant.
            Company: ConnecTra Inc. | Be concise and helpful.`
          },
          {
            role: 'user',
            content: `Presentation Context:\n${context}\n\nQuestion: ${transcript.text}`
          }
        ],
        max_tokens: 300
      });

      // TTS Response
      const speech = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: this.voice,
        input: response.choices[0].message.content
      });

      return {
        text: response.choices[0].message.content,
        audio: await speech.arrayBuffer()
      };
    } catch (err) {
      console.error('ConnecTra AI processing error:', err);
      return { text: 'Sorry, I encountered an issue processing your request.', audio: null };
    }
  }
}

module.exports = ConnecTraAIAgent;

// Usage in WebSocket: new ConnecTraAIAgent(sessionId, pptUrl).processQuestion(audioBlob)
