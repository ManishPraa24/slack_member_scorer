// Used for getting a slack-bot frame-work
import pkg from '@slack/bolt';
const { App } = pkg;

import { WebClient } from '@slack/web-api';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Used for health checks and testing endpoints
import express from 'express';
import dotenv from 'dotenv';

// Axios: Useful for making external API request
import axios from 'axios';

dotenv.config();

const log = {
    info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
    debug: (msg, ...args) => console.log(`[DEBUG] ${msg}`, ...args)
};

