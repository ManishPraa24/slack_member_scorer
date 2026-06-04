// Used for getting a slack-bot frame-work
import pkg from "@slack/bolt";
const { App } = pkg;

import { WebClient } from "@slack/web-api";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Used for health checks and testing endpoints
import express from "express";
import dotenv from "dotenv";

// Axios: Useful for making external API request
import axios from "axios";

dotenv.config();

const log = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
  debug: (msg, ...args) =>
    process.env.NODE_ENV === "development" &&
    console.log(`[DEBUG] ${msg}`, ...args),
};

class SlackAIAgent {
  constructor() {
    this.app = express();
    this.slack = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
    });
    this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.groq = new ChatGroq({
      model: "groq/compound-mini",
      temperature: 0.3,
      apiKey: process.env.GROQ_API_KEY,
    });

    // Register Slack event listener
    // This will run when anyone joins the channel
    this.setupSlackEvents;
    this.setupExpress();
  }

  setupSlackEvents() {
    this.slack.event("team_join", async ({ event }) => {
      try {
        log.info(
          `New member joined: ${event.user.real_name || event.user.name}`,
        );
        const userInfo = await this.getUserInfo(event.user.id);
        await this.analyzeAndPostMember(userInfo);
      } catch (error) {
        log.error("Error processing team_join: ", error.message);
      }
    });

    this.slack.event("member_joined_channel", async ({ event }) => {
      try {
        //  Channel type C in slack means it is a public channel
        if (event.channel_type == "C") {
          log.info(`Member ${event.user} joined channel ${event.channel}`);
          const userInfo = await this.getUserInfo(event.user);
          await this.analyzeAndPostMember(userInfo);
        }
      } catch (error) {
        log.error("Error processing member_joined_channel: ", error.message);
      }
    });
    this.slack.error(async (error) =>
      log.error("Slack error: ", error.message),
    );
  }

  // Configuring express server

  setupExpress() {
    this.app.use(express.json());

    this.app.get("/health", (req, res) => {
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    });

    if (process.env.NODE_ENV == "development") {
      this.app.post("/test/analyze-member", async (req, res) => {
        try {
          const { memberInfo } = req.body;

          if (!memberInfo) {
            return res.status(400).json({ error: "memberInfo is required" });
          }

          const analysis = await this.analyzeAndPostMember(memberInfo);

          res.json({
            success: true,
            analysis,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          log.error("Test analysis error: ", error.message);
          res
            .status(500)
            .json({ error: "Analysis failed", message: error.message });
        }
      });
    }

    this.app.use((err, req, res, next) => {
      log.error("Express error", err.message);
      res.status(500).json({ error: "Internal server error" });
    });
    }
    

    // Getting the user Information

    async getUserInfo(userId) {
        const result = await this.webClient.users.info({ user: userId });

        const user = result.user;

        return {
            id: user.id,
            name: user.real_name || user.name,
            username: user.name,
            email: user.profile?.email,
            title: user.profile?.title,
            timezone: user.tz,
            profile: {
                firstName: user.profile?.first_name,
                lastName: user.profile?.last_name,
                statusText: user.profile?.status_text
            }
        }

    }

    async analyzeAndPostMember(memberInfo) {
        let analysisId = null;

        try {
            log.info(`Processing member: ${memberInfo.name}`);

            // Step - 1
            const researchData = await this.doBasicResearch(memberInfo);
            
            // Step - 2
            const analysis = await this.analyzeWithAI(memberInfo, researchData);

            log.info(`Saving analysis to database for ${memberInfo.name}`);

            // Step - 3
            analysisId = await saveMemberAnalysis(memberInfo, analysis, researchData);

            // Step - 4
            await this.postAnalysisToChannel(memberInfo, analysis, researchData);

            // Step - 5
            if (analysisId) {
                await markAsSentToSlack(analysisId);
            }

        }
        catch (error) {
            log.error(`Error processing ${memberInfo.name}: `, error.message);
            if (analysisId) {
                log.info(`Analysis ${analysisId} saved to database but not sent to slack due to error.`)
            }
            throw error;
        }
    }

    // Gather's publicly available information of the member's
    // company website, github, etc.

    async doBasicResearch() {

        const results = [];

        try {
            if (memberInfo.email && !this.isPersonalEmail(memberInfo.email)) {
                
                const domain = memberInfo.email.split('@')[1];
                const companyInfo = await this.getCompanyInfo(domain);

                if (companyInfo) {
                    results.push(companyInfo);
                }

                if (memberInfo.name) {
                    const githubInfo = await this.getGitHubInfo(memberInfo.name);

                    if (githubInfo) results.push(githubInfo);
                }

            }
        }
        catch (error) {
            log.error('Research error: ', error.message);
        }

        return results;
    }

}
