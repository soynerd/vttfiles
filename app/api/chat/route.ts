import { NextRequest, NextResponse } from "next/server";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import OpenAI from "openai";

// This function will be the core logic for handling a chat message.
async function handleChat(userQuery: string) {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // === Step 1: Determine the correct database based on the user's query ===
    const dbSelectionSystemMessage = `You are an AI assistant for finding result on vtt files of lectures who helps resolving user query.
     Based on user query only strictly return "ChaiCode-NodeJS" for query related to 'nodejs' and "ChaiCode-Python" for query related to python. You don't have to solve the query just return the database name only. If user query is not related to nodejs or python then strictly return "none". 
    
    for ex:
    user: {"message": "tell me about event loop in nodejs?"},
    assistant: { "message":"Hanji, To aapko event loop ke bare me janana h. Thoda sochne ka samay de maine ye kaha padhaya h.",  "db":"ChaiCode-NodeJS" }
    user: {"message": "tell me about vertical scaling?"},
    assistant: {"message":"Hanji, apko vertical scaling janni hai.",  "db": "ChaiCode-NodeJS" }
    user: {"message": "tell me about list in rust?"},
    assistant: {"message":"Hanji, Dekhiye app NodeJs ya Python se related hi question puche.",  "db": "none" }`;

    const dbSelectionResponse = await client.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
            { role: "system", content: dbSelectionSystemMessage },
            { role: "user", content: userQuery }
        ],
    });

    const parsedResponse = JSON.parse(
        dbSelectionResponse.choices[0].message.content || "{}"
    );
    const userDB = parsedResponse.db;
    console.log(userDB);

    if (userDB === "none") {
        return parsedResponse.message || "I can only answer questions about NodeJS or Python.";
    }

    // === Step 2: Retrieve relevant context from the selected Qdrant collection ===
    const embeddings = new OpenAIEmbeddings({
        modelName: "text-embedding-3-large",
        openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
            url: process.env.QDRANT_URL,
            collectionName: userDB,
            apiKey: process.env.QDRANT_API_KEY,
        }
    );

    const retriever = vectorStore.asRetriever({ k: 5 });
    const matchedData = await retriever.invoke(userQuery);
    //console.log("matched::::::::::", matchedData);

    // === Step 3: Generate the final answer using the retrieved context ===
    const finalAnswerSystemPrompt = `
    You are a helpful AI tutor. Your user is asking a question about a video lecture.
    Based ONLY on the provided context from the video transcript below, answer the user's query in a clear and helpful way.
    If the context doesn't contain the answer, state that you couldn't find the information in the provided lecture content.
    For each piece of information you provide, you MUST cite the source lecture and the start time. For example: "Node.js is a JavaScript runtime [lecture: Getting-Started-with-NodeJS, start_time: 00:01:34]."
    keep the exact word used in the context while answering.
    Never answer based on your prior knowledge, always rely on the provided context.
    higlight the lecture and time stamp.

    Context:
    ${JSON.stringify(matchedData, null, 2)}               
    `;

    const finalResponse = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
            { role: "system", content: finalAnswerSystemPrompt },
            { role: "user", content: userQuery },
        ],
    });

    return finalResponse.choices[0].message.content;
}

// This is the actual API endpoint that the frontend will call.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const userQuery = body.message;

        if (!userQuery) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        const botResponse = await handleChat(userQuery);

        return NextResponse.json({ response: botResponse });
    } catch (error) {
        console.error("Error in chat API:", error);
        return NextResponse.json(
            { error: "An internal server error occurred." },
            { status: 500 }
        );
    }
}