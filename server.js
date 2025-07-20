const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN; // <-- Set your WhatsApp API access token here
const phoneNumberId = process.env.PHONE_NUMBER_ID; 
const geminiApiKey = process.env.GEMINI_API_KEY; 

const genAI = new GoogleGenerativeAI(geminiApiKey);// <-- Set your WhatsApp phone number ID

// Verification endpoint for webhook setup
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Handle incoming WhatsApp messages and reply
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2)); // Optional: Log the full payload

  // Step 1: Extract the message data
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const from = message?.from; // WhatsApp ID of the user
    const userText = String(req.body.entry[0].changes[0].value['messages'][0]['text']);
    console.log(`Received message from ${from}: ${userText}`);
    if (from) {
      // Step 2: Prepare your response text (LLM response can be plugged in here)
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const geminiResult = await model.generateContent(userText);
      const replyMessage = geminiResult.response.text() || "This is a message from Gemini LLM.";

      // Step 3: Send reply using WhatsApp Business API
      await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: replyMessage }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      console.log(`Sent reply to ${from}`);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});