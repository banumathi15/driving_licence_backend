# Driving Licence AI — Backend

## 1. Project Overview

The Driving Licence AI backend is a REST API built with Node.js and Express. It accepts driving licence documents, extracts text using PDF processing and OCR, identifies structured licence fields, stores document data temporarily, and answers questions using retrieved document content.

The backend supports a demo fallback mode for basic rule-based extraction when an OpenAI API key is not configured.

## 2. Technology Stack

Node.js — JavaScript runtime.

Express.js — REST API framework.

Multer — Multipart file upload handling.

PDF.js (pdfjs-dist) — PDF text extraction and page processing.

Tesseract.js — OCR for images and scanned PDF pages.

@napi-rs/canvas — Canvas rendering for PDF page images.

file-type — File type detection using file contents.

OpenAI Node.js SDK — LLM integration.

Zod — Structured output and schema validation.

openai/helpers/zod — Structured response formatting for supported OpenAI models.

UUID generation — Unique document identifiers.

## 3. Architecture

The backend uses a service-oriented structure to separate HTTP handling from document processing and extraction logic.

Client / React Frontend
|
v
Express REST API
|
v
Upload Validation
|
v
Document Processing
/ \
 v v
PDF.js Tesseract OCR
\ /
v v
Extracted Text
|
v
Field Extraction
/ \
 v v
Rule-based OpenAI LLM
Fallback (Optional)
\ /
v v
Zod Validation
|
v
Document Storage
|
v
JSON API Response

Document Q&A:
Question → Chunking → Relevant Text Retrieval
→ LLM Answer (when configured)
→ Answer and Sources

Main Modules

Application and routes: Configure Express and expose API endpoints.

documentService.js: Validates document content, extracts PDF text, and invokes OCR when required.

extractionService.js: Extracts structured driving licence fields using rule-based logic or the LLM.

ragService.js: Splits document text into chunks, retrieves relevant content, and supports document Q&A.

schemas.js: Defines the Zod schema for extracted licence fields.

## 4. Setup and Run Instructions

Prerequisites

Node.js and npm installed.

A valid OpenAI API key for LLM-based extraction and question answering.

PDF.js and OCR dependencies installed successfully.

Installation

Navigate to the backend directory:

cd backend
npm install

Environment Configuration

Create a .env file in the backend root directory:

PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
MAX_FILE_MB=10

Set OPENAI_API_KEY to a valid API key if you want to enable OpenAI API features. Leave it empty to use the demo fallback where supported.

Important: ChatGPT subscription access does not automatically include OpenAI API credits. API usage and billing are managed separately.

Never commit .env or expose the API key in frontend code or public repositories.

Start the Development Server

npm run dev

The API should start at:

http://localhost:4000

Health Check

Open:

http://localhost:4000/api/health

The health endpoint reports whether the server is running and whether the LLM is configured.

## 5. API Endpoints

Method

Endpoint

Purpose

GET

/api/health

Check API status and LLM configuration

POST

/api/documents

Upload and process a document

GET

/api/documents/:id

Retrieve a processed document

PUT

/api/documents/:id

Save reviewed licence fields

POST

/api/documents/:id/chat

Ask a question about the document

Supported Document Types

PDF

PNG

JPEG

The configured maximum upload size is 10 MB by default, subject to the application's upload middleware.

## 6. AI/LLM Approach

Document Text Extraction

PDF.js extracts selectable text from PDF pages. For scanned PDFs or pages containing little text, the backend renders pages and uses Tesseract.js OCR.

Structured Field Extraction

The backend extracts fields such as:

Full name

Licence number

Date of birth

Issue date

Expiry date

Address

Vehicle classes

Issuing authority

Other information

When a valid OpenAI API key is configured, the backend requests structured output using the OpenAI SDK and a Zod response schema.

The extraction prompt instructs the model to use explicit document evidence, avoid guessing, and return null for missing or ambiguous scalar fields.

Demo Fallback

When the API key is absent, the backend uses regular expressions and other rule-based logic to identify fields.

This approach is useful for testing without API charges, but it is less flexible than an LLM and depends on recognized text and supported patterns.

Retrieval-Augmented Generation (RAG)

The document Q&A workflow:

Splits extracted text into manageable chunks.

Retrieves relevant chunks for the user's question.

Supplies the relevant evidence to the LLM.

Generates an answer based on the retrieved document content.

Returns the answer and available source references.

The current implementation uses lexical retrieval rather than a vector database. It does not require embeddings for its basic retrieval workflow.

## 7. Key Technical Decisions

Express REST API: Keeps the backend interface simple and compatible with a React frontend.

Service separation: Separates document processing, extraction, and question answering.

PDF.js and Tesseract.js: Support both text-based PDFs and scanned documents.

Zod validation: Enforces the expected structure of extracted fields.

Optional LLM integration: Allows basic testing without an OpenAI API key.

Rule-based fallback: Provides predictable extraction for supported labels and formats.

Temporary in-memory storage: Simplifies the demo without requiring database infrastructure.

Document IDs: Allow the frontend to retrieve and update individual processed documents.

File validation: Checks file type and upload limits before processing.

## 8. Known Limitations

Rule-based extraction may miss dates or fields that use unfamiliar labels or formats.

OCR accuracy depends on document quality, language, rotation, and image resolution.

PDF processing depends on compatible PDF.js and canvas dependencies.

LLM functionality requires valid API credentials and available API access.

In-memory storage is temporary; documents may be lost when the server restarts.

In-memory storage is unsuitable for multi-instance production deployments.

Lexical retrieval may miss relevant content when the wording differs significantly from the user's question.

The application does not verify whether a driving licence is genuine or valid with a government authority.

Extracted fields must be reviewed by a user before being relied upon.

Production deployment requires additional operational, privacy, and security controls.

## 9. AI Development Tools Used

The following tools may be used during development. Confirm the tools actually used for this submission before finalizing this list.

ChatGPT: Assistance with debugging, implementation guidance, regex improvements, and documentation.

OpenAI API: Optional LLM-based extraction and question answering when configured.

Visual Studio Code: Code editing and debugging.

## 10. Security Considerations

Keep API keys in backend environment variables.

Validate uploaded file content instead of trusting the filename or client-provided MIME type.

Enforce file size and page-count limits.

Restrict CORS to the configured frontend origin.

Return safe error messages to clients and log diagnostic details only on the server.

Avoid retaining personal licence data longer than necessary.

Add authentication, rate limiting, persistent storage controls, and stronger access controls before production deployment.
