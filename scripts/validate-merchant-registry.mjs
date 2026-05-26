#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultRegistryPath = path.join(repoRoot, "ops", "merchants.local.json");
const registryPath = path.resolve(process.argv[2] || defaultRegistryPath);

const allowedStatuses = new Set(["planned", "pilot", "active", "paused", "retired"]);
const requiredStringFields = [
  "merchantId",
  "slug",
  "shopDomain",
  "flyApp",
  "appUrl",
  "shopifyAppName",
  "shopifyClientId",
  "status",
];

const errors = [];

function addError(message) {
  errors.push(message);
}

function readRegistry(filePath) {
  if (!fs.existsSync(filePath)) {
    addError(`Registry file does not exist: ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    addError(`Registry is not valid JSON: ${error.message}`);
    return null;
  }
}

function assertUnique(value, field, seen, merchantLabel) {
  if (!value) {
    return;
  }

  if (seen.has(value)) {
    addError(`${merchantLabel}.${field} duplicates ${seen.get(value)}`);
    return;
  }

  seen.set(value, merchantLabel);
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateMerchant(merchant, index, uniqueValues) {
  const merchantLabel = `merchants[${index}]`;

  if (!merchant || typeof merchant !== "object" || Array.isArray(merchant)) {
    addError(`${merchantLabel} must be an object`);
    return;
  }

  for (const field of requiredStringFields) {
    if (typeof merchant[field] !== "string" || merchant[field].trim() === "") {
      addError(`${merchantLabel}.${field} must be a non-empty string`);
    }
  }

  if (
    typeof merchant.merchantId === "string" &&
    !/^m[0-9]{3,}$/.test(merchant.merchantId)
  ) {
    addError(`${merchantLabel}.merchantId must look like m001`);
  }

  if (
    typeof merchant.slug === "string" &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(merchant.slug)
  ) {
    addError(`${merchantLabel}.slug must use lowercase letters, numbers, and hyphens`);
  }

  if (
    typeof merchant.shopDomain === "string" &&
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(merchant.shopDomain)
  ) {
    addError(`${merchantLabel}.shopDomain must be a .myshopify.com domain`);
  }

  if (
    typeof merchant.flyApp === "string" &&
    !/^pl-m[0-9]{3,}$/.test(merchant.flyApp)
  ) {
    addError(`${merchantLabel}.flyApp must look like pl-m001`);
  }

  if (
    typeof merchant.merchantId === "string" &&
    typeof merchant.flyApp === "string" &&
    merchant.flyApp !== `pl-${merchant.merchantId}`
  ) {
    addError(`${merchantLabel}.flyApp should be pl-${merchant.merchantId}`);
  }

  if (typeof merchant.appUrl === "string" && !isHttpsUrl(merchant.appUrl)) {
    addError(`${merchantLabel}.appUrl must be an https URL`);
  }

  if (
    merchant.customDomain !== undefined &&
    merchant.customDomain !== null &&
    (typeof merchant.customDomain !== "string" || merchant.customDomain.trim() === "")
  ) {
    addError(`${merchantLabel}.customDomain must be a non-empty string or null`);
  }

  if (typeof merchant.status === "string" && !allowedStatuses.has(merchant.status)) {
    addError(
      `${merchantLabel}.status must be one of: ${Array.from(allowedStatuses).join(", ")}`,
    );
  }

  assertUnique(merchant.merchantId, "merchantId", uniqueValues.merchantIds, merchantLabel);
  assertUnique(merchant.slug, "slug", uniqueValues.slugs, merchantLabel);
  assertUnique(merchant.shopDomain, "shopDomain", uniqueValues.shopDomains, merchantLabel);
  assertUnique(merchant.flyApp, "flyApp", uniqueValues.flyApps, merchantLabel);
  assertUnique(merchant.appUrl, "appUrl", uniqueValues.appUrls, merchantLabel);
  assertUnique(
    merchant.shopifyClientId,
    "shopifyClientId",
    uniqueValues.shopifyClientIds,
    merchantLabel,
  );

  if (merchant.customDomain) {
    assertUnique(
      merchant.customDomain,
      "customDomain",
      uniqueValues.customDomains,
      merchantLabel,
    );
  }
}

const registry = readRegistry(registryPath);

if (registry) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    addError("Registry root must be an object");
  }

  if (registry.version !== 1) {
    addError("Registry version must be 1");
  }

  if (!Array.isArray(registry.merchants)) {
    addError("Registry must include a merchants array");
  } else {
    const uniqueValues = {
      merchantIds: new Map(),
      slugs: new Map(),
      shopDomains: new Map(),
      flyApps: new Map(),
      appUrls: new Map(),
      customDomains: new Map(),
      shopifyClientIds: new Map(),
    };

    registry.merchants.forEach((merchant, index) => {
      validateMerchant(merchant, index, uniqueValues);
    });
  }
}

if (errors.length > 0) {
  console.error(`Merchant registry validation failed: ${path.relative(repoRoot, registryPath)}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Merchant registry is valid: ${path.relative(repoRoot, registryPath)}`);
