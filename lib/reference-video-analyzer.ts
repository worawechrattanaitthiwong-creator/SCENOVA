export type ReferenceVideoAnalysis = {
  aspectRatio: string;
  estimatedDurationSec?: number;
  visualStyle: string[];
  mood: string[];
  colorPalette: string[];
  lighting: string[];
  cameraLanguage: string[];
  shotPatterns: string[];
  motionPatterns: string[];
  continuityNotes: string[];
  suggestedStylePrompt: string;
  suggestedCameraLock: string;
};

export interface ReferenceVideoAnalyzer {
  id: string;
  analyze(input: { assetUrl: string; fileName?: string }): Promise<ReferenceVideoAnalysis>;
}

/**
 * Mock result ใช้ให้ UI/DB/Flow พัฒนาได้ก่อนเชื่อม Multimodal AI จริง
 * Production analyzer อาจใช้โมเดล Vision/Video understanding เพื่อสรุป Style, Shot, Camera, Lighting และ Motion
 */
export class MockReferenceVideoAnalyzer implements ReferenceVideoAnalyzer {
  id = "mock-reference-video-analyzer";

  async analyze(): Promise<ReferenceVideoAnalysis> {
    return {
      aspectRatio: "9:16",
      visualStyle: ["cinematic anime", "storybook", "painterly environment"],
      mood: ["warm", "curious", "gentle", "slightly mysterious"],
      colorPalette: ["warm cream", "dusty pink", "amber orange", "deep navy", "muted violet"],
      lighting: ["golden hour", "warm backlight", "soft rim light", "dappled shadows"],
      cameraLanguage: ["low camera placement", "wide-to-close alternation", "foreground occlusion", "restrained push-ins"],
      shotPatterns: ["establishing wide", "tracking follow", "reaction close-up", "hidden reveal", "action crossing", "distant wide ending"],
      motionPatterns: ["slow natural walking", "subtle secondary hair/clothing motion", "short readable creature run"],
      continuityNotes: ["preserve character scale", "consistent sunset direction", "maintain signature props and costume"],
      suggestedStylePrompt: "cinematic Japanese anime storybook film, painterly residential environment, warm golden-hour backlight, subtle 2D/3D dimensionality, soft filmic grading",
      suggestedCameraLock: "favor low-angle observational composition, intimate reaction close-ups, natural foreground occlusion, restrained physically believable movement",
    };
  }
}
