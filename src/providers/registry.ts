import type { ImageUploadProvider } from "./types";

export class ProviderRegistry {
  private providers: Map<string, ImageUploadProvider> = new Map();

  register(provider: ImageUploadProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  get(providerId: string): ImageUploadProvider | undefined {
    return this.providers.get(providerId);
  }
}
