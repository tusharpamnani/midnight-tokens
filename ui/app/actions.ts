"use server";

import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

config({ path: path.resolve(process.cwd(), "..", ".env") });

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(process.cwd(), "..");

function fileIfExists<T>(absolutePath: string): T | null {
  if (!fs.existsSync(absolutePath)) return null;
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

type Deployment = {
  contractAddress: string;
  seed?: string;
  network?: string;
  deployedAt?: string;
};

type FactoryDeployment = {
  factoryAddress: string;
  seed?: string;
  network?: string;
  deployedAt?: string;
};

export async function getDeployment() {
  return fileIfExists<Deployment>(path.join(ROOT_DIR, "deployment.json"));
}

export async function getFactoryDeployment() {
  return fileIfExists<FactoryDeployment>(
    path.join(ROOT_DIR, "factory-deployment.json"),
  );
}

async function runCli(args: string[]) {
  const cliPath = path.join(ROOT_DIR, "dist", "cli.js");

  const { stdout, stderr } = await execFileAsync("node", [cliPath, ...args], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PRIVATE_STATE_PASSWORD:
        process.env.PRIVATE_STATE_PASSWORD || "Str0ng!MidnightLocal",
    },
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return { stdout, stderr };
}

export async function actionWalletInfo() {
  const { stdout } = await runCli(["wallet-info"]);
  const coinKey = stdout
    .split("\n")
    .find((l) => l.toLowerCase().includes("coin public key"))?.split(":")
    .slice(1)
    .join(":")
    .trim();
  const address = stdout
    .split("\n")
    .find((l) => l.toLowerCase().includes("unshielded address"))?.split(":")
    .slice(1)
    .join(":")
    .trim();
  return { stdout, coinKey: coinKey || null, address: address || null };
}

export async function actionDeployToken() {
  return await runCli(["deploy"]);
}

export async function actionDeployFactory() {
  return await runCli(["deploy-factory"]);
}

export async function actionMint(params: { tokenAddress: string; to: string; amount: string }) {
  return await runCli(["mint", params.to, params.amount, "--token", params.tokenAddress]);
}

export async function actionTransfer(params: { tokenAddress: string; to: string; amount: string }) {
  return await runCli(["transfer", params.to, params.amount, "--token", params.tokenAddress]);
}

export async function actionBurn(params: { tokenAddress: string; amount: string }) {
  return await runCli(["burn", params.amount, "--token", params.tokenAddress]);
}

export async function actionFinishMinting(params: { tokenAddress: string }) {
  return await runCli(["finish-minting", "--token", params.tokenAddress]);
}

export async function actionTotalSupply(tokenAddress: string) {
  const { stdout } = await runCli(["total-supply", "--token", tokenAddress]);
  return stdout.trim().split("\n").pop() || "";
}

export async function actionBalanceOf(params: { tokenAddress: string; account: string }) {
  const { stdout } = await runCli(["balance-of", params.account, "--token", params.tokenAddress]);
  return stdout.trim().split("\n").pop() || "";
}

export async function actionFactoryCount(factoryAddress: string) {
  const { stdout } = await runCli(["factory-count", factoryAddress]);
  return stdout.trim().split("\n").pop() || "0";
}

export async function actionFactoryTokenAt(factoryAddress: string, index: string) {
  const { stdout } = await runCli(["factory-token-at", factoryAddress, index]);
  return stdout.trim().split("\n").pop() || "";
}

export async function actionFactoryMeta(factoryAddress: string, tokenAddressHex: string) {
  const { stdout } = await runCli(["factory-meta", factoryAddress, tokenAddressHex]);
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) return { raw: stdout };
  return JSON.parse(stdout.slice(jsonStart));
}

export async function actionFactoryListTokens(factoryAddress: string) {
  const countStr = await actionFactoryCount(factoryAddress);
  const count = Number(countStr);
  const tokens: Array<any> = [];
  for (let i = 0; i < count; i++) {
    const tokenHex = await actionFactoryTokenAt(factoryAddress, String(i));
    const meta = await actionFactoryMeta(factoryAddress, tokenHex);
    tokens.push(meta);
  }
  return tokens;
}
