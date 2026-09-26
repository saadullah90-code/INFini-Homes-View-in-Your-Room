// 3D generation provider abstraction.
//
// CRITICAL: this app must never spend real Meshy credits without explicit,
// separate user approval (the phrase "APPROVE FIRST LIVE GENERATION" in the
// project spec). Gating is enforced server-side via the persisted
// `meshyLiveGenerationEnabled` setting -- NOT just by checking whether
// MESHY_API_KEY exists -- so adding the key alone can never trigger a live
// spend. Only flipping the setting (via PATCH /settings, itself an explicit
// admin action) can do that, and even then this module currently only
// implements the mock path; a real Meshy client is out of scope for Phase 1.

export interface MeshyGenerationResult {
  originalModelUrl: string;
  thumbnailUrl: string;
  fileSizeBytes: number;
  providerTaskId: string;
}

// A small set of freely-licensed sample GLB models (Khronos glTF sample
// assets) used to simulate provider output in mock mode, so the review/
// approve/publish pipeline has something real to render in <model-viewer>.
const SAMPLE_MODELS = [
  {
    url: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
    thumbnail: "https://modelviewer.dev/shared-assets/models/Astronaut.webp",
  },
  {
    url: "https://modelviewer.dev/shared-assets/models/Chair.glb",
    thumbnail: "https://modelviewer.dev/shared-assets/models/Chair.webp",
  },
];

export type MeshyMode = "mock" | "live" | "unavailable";

export function getMeshyMode(liveGenerationEnabled: boolean): MeshyMode {
  const hasApiKey = !!process.env.MESHY_API_KEY;
  if (liveGenerationEnabled && hasApiKey) {
    return "live";
  }
  return "mock";
}

export function getMeshyStatusDetail(liveGenerationEnabled: boolean): {
  configured: boolean;
  mode: MeshyMode;
  detail: string;
} {
  const hasApiKey = !!process.env.MESHY_API_KEY;
  if (liveGenerationEnabled && hasApiKey) {
    return {
      configured: true,
      mode: "live",
      detail: "MESHY_API_KEY is set and live generation is enabled in Settings.",
    };
  }
  if (hasApiKey && !liveGenerationEnabled) {
    return {
      configured: true,
      mode: "mock",
      detail:
        "MESHY_API_KEY is set, but live generation is disabled in Settings -- all generations use the mock provider.",
    };
  }
  return {
    configured: false,
    mode: "mock",
    detail: "MESHY_API_KEY is not set -- all generations use the mock provider.",
  };
}

/**
 * Mock generation -- always used unless a future phase adds a real Meshy
 * client. Returns deterministic, freely-licensed sample assets so the review
 * pipeline has real GLB files to preview.
 */
export async function generateMockModel(
  productId: number,
): Promise<MeshyGenerationResult> {
  const sample = SAMPLE_MODELS[productId % SAMPLE_MODELS.length];
  return {
    originalModelUrl: sample.url,
    thumbnailUrl: sample.thumbnail,
    fileSizeBytes: 500_000 + Math.floor(Math.random() * 500_000),
    providerTaskId: `mock-${Date.now()}-${productId}`,
  };
}
