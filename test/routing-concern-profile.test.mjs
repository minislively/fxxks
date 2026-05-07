// @ts-check
/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const { detectDomainFromSource } = require(path.join(repoRoot, "dist", "core", "domain-detector.js"));
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
const { assessFrontendPayloadPolicy, toFrontendPayloadBuildOptions } = require(path.join(repoRoot, "dist", "core", "payload-policy", "registry.js"));
const { assessFrontendProfilePayloadReuse } = require(path.join(repoRoot, "dist", "core", "payload-policy", "profile-gate.js"));
const { UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON } = require(path.join(repoRoot, "dist", "core", "payload-policy", "fallback.js"));

function buildPayloadForSource(source, fileName, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-routing-concern-"));
  try {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, source);
    const domainDetection = detectDomainFromSource(source, filePath);
    const policy = assessFrontendPayloadPolicy(domainDetection);
    const payload = toModelFacingPayload(extractFile(filePath), tempDir, {
      includeEditGuidance: false,
      includeReactWebContextMetadata: true,
      ...toFrontendPayloadBuildOptions(policy),
      ...options,
    });
    return { domainDetection, policy, payload };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function profileById(payload, id) {
  return payload.concernProfiles?.find((profile) => profile.id === id);
}

test("concern-only Next routing source emits non-authorizing routing concern evidence", () => {
  const source = `
    import Link from "next/link";
    import { useParams, useSearchParams } from "next/navigation";

    export function ConcernOnlyRoutingNote() {
      const params = useParams<{ slug: string }>();
      const searchParams = useSearchParams();
      return { slug: params.slug, tab: searchParams.get("tab"), href: "/users/" + params.slug, Link };
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyRoutingNote.tsx");
  const routingProfile = profileById(payload, "routing");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.equal(payload.reactWebContext, undefined);
  assert.deepEqual(routingProfile, {
    kind: "concern",
    id: "routing",
    claim: "This source contains routing concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["Link", "next-link", "next-navigation", "route-param", "search-param"],
  });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), {
    allowed: false,
    reason: UNSUPPORTED_FRONTEND_DOMAIN_PROFILE_REASON,
  });
});

test("concern-only React Router source emits non-authorizing routing concern evidence", () => {
  const source = `
    import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

    export function ConcernOnlyRouterNote() {
      const navigate = useNavigate();
      const params = useParams();
      const [searchParams] = useSearchParams();
      return { navigate, slug: params.slug, tab: searchParams.get("tab"), Link };
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "ConcernOnlyRouterNote.tsx");
  const routingProfile = profileById(payload, "routing");

  assert.equal(domainDetection.classification, "unknown");
  assert.equal(policy.allowed, false);
  assert.deepEqual(routingProfile, {
    kind: "concern",
    id: "routing",
    claim: "This source contains routing concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["Link", "react-router-dom", "route-param", "search-param", "useNavigate"],
  });
});

test("React Web plus routing concern keeps concern metadata separate from authorization", () => {
  const source = `
    import Link from "next/link";
    import { useParams, useRouter, useSearchParams } from "next/navigation";

    export function UserNav() {
      const params = useParams<{ slug: string }>();
      const router = useRouter();
      const searchParams = useSearchParams();
      return (
        <div>
          <button onClick={() => router.push('/users/' + params.slug + '?tab=' + (searchParams.get('tab') ?? 'overview'))}>Go</button>
          <Link href={'/users/' + params.slug}>Profile</Link>
        </div>
      );
    }
  `;
  const { domainDetection, policy, payload } = buildPayloadForSource(source, "UserNav.tsx");
  const withoutDomainPayload = { ...payload };
  delete withoutDomainPayload.domainPayload;
  const routingProfile = profileById(payload, "routing");

  assert.equal(domainDetection.classification, "react-web");
  assert.equal(policy.allowed, true);
  assert.deepEqual(routingProfile, {
    kind: "concern",
    id: "routing",
    claim: "This source contains routing concern evidence.",
    nonAuthorizationBoundary: "concern-evidence-only; never domain evidence; never standalone compact-payload authorization",
    signals: ["Link", "next-link", "next-navigation", "route-param", "search-param", "useRouter"],
  });
  assert.ok(payload.domainPayload);
  assert.equal("concernProfiles" in payload.domainPayload, false);
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, payload, policy), { allowed: true });
  assert.deepEqual(assessFrontendProfilePayloadReuse(".tsx", domainDetection, withoutDomainPayload, policy).allowed, false);
});

test("routing concern stays fail-closed for weak param-only names and route-like strings", () => {
  const source = `
    const params = { slug: "local-only" };
    const searchParams = new URLSearchParams("tab=overview");
    const routeQuery = "/users/[slug]";

    export function NotesOnly() {
      return { params, tab: searchParams.get("tab"), routeQuery };
    }
  `;
  const { payload } = buildPayloadForSource(source, "NotesOnly.tsx");

  assert.equal(profileById(payload, "routing"), undefined);
});
