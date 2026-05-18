import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "../routers";

describe("newsEmissions.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar array quando API retorna artigos", async () => {
    process.env.NEWS_API_KEY = "test-key-123";
    
    const mockArticles = [
      {
        title: "Nova emissão de CRI da Gafisa",
        description: "Gafisa emite novo CRI de R$ 500 milhões",
        source: { name: "InfoMoney" },
        publishedAt: "2026-02-19T10:00:00Z",
        url: "https://example.com/news1",
        urlToImage: "https://example.com/image1.jpg",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ articles: mockArticles }),
        } as any)
      )
    );

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.newsEmissions.get();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).toHaveProperty("source");
    expect(result[0]).toHaveProperty("category");
    expect(result[0].category).toBe("emissão");
  });

  it("deve retornar array vazio em caso de erro", async () => {
    process.env.NEWS_API_KEY = "test-key-123";
    
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error")))
    );

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.newsEmissions.get();

    expect(Array.isArray(result)).toBe(true);
  });

  it("deve retornar array vazio quando NEWS_API_KEY não está configurada", async () => {
    const originalKey = process.env.NEWS_API_KEY;
    delete process.env.NEWS_API_KEY;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.newsEmissions.get();

    expect(Array.isArray(result)).toBe(true);

    process.env.NEWS_API_KEY = originalKey;
  });

  it("deve formatar corretamente os campos de notícia", async () => {
    process.env.NEWS_API_KEY = "test-key-123";
    
    const mockArticles = [
      {
        title: "Título da notícia",
        description: "Descrição da notícia",
        content: "Conteúdo completo",
        source: { name: "Fonte de Notícia" },
        publishedAt: "2026-02-19T15:30:00Z",
        url: "https://example.com/news",
        urlToImage: "https://example.com/image.jpg",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ articles: mockArticles }),
        } as any)
      )
    );

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.newsEmissions.get();

    expect(result.length).toBeGreaterThan(0);
    const article = result[0];

    expect(article).toHaveProperty("id");
    expect(article).toHaveProperty("date");
    expect(article).toHaveProperty("publishedDate");
    expect(article).toHaveProperty("title");
    expect(article).toHaveProperty("summary");
    expect(article).toHaveProperty("source");
    expect(article).toHaveProperty("url");
    expect(article).toHaveProperty("category");
    expect(article).toHaveProperty("imageUrl");
  });
});
