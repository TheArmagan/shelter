type RepositoryDeployments = {
  nodes: RepositoryDeploymentNode[];
};
type RepositoryDeploymentNode = {
  state: "ACTIVE" | unknown;
  latestStatus: {
    state: "SUCCESS" | unknown;
    environmentUrl: string | null;
  };
};
type RepositoryWorkflowsObject = {
  entries: {
    name: string;
    type: "blob";
    object: {
      text: string;
    };
  }[];
};
type RepositoryPluginsObject = {
  entries: {
    name: string;
    type: "tree";
    object: {
      entries: {
        name: string;
        type: "blob";
        object: {
          text: string;
        };
      }[];
    };
  }[];
};
type PageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};
type ResultType = {
  data: {
    search: {
      nodes: {
        nameWithOwner: string;
        deployments: RepositoryDeployments;
        workflows: RepositoryWorkflowsObject | null;
        plugins: RepositoryPluginsObject | null;
      }[];
      pageInfo: PageInfo;
    };
  };
};

const gql = String.raw;
const query = gql`query {
  search(query: "shelter-plugins", type: REPOSITORY, first: 100) {
    nodes {
      ... on Repository {
        nameWithOwner
        deployments(first: 10, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            state
            latestStatus {
              state
              environmentUrl
            }
          }
        }
        workflows: object(expression: "HEAD:.github/workflows") {
          ... on Tree {
            entries {
              name
              type
              object {
                ... on Blob {
                  text
                }
              }
            }
          }
        }
        plugins: object(expression: "HEAD:plugins") {
          ... on Tree {
            entries {
              name
              type
              object {
                ... on Tree {
                  entries {
                    name
                    type
                    object {
                      ... on Blob {
                        text
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

const hopefullyUsesLune = (object: RepositoryWorkflowsObject) =>
  object.entries.some((e) => e.type === "blob" && e.object.text.includes("lune"));

const getEnvironmentUrl = (deployments: RepositoryDeployments) =>
  deployments.nodes.find((d) => d.state === "ACTIVE")?.latestStatus.environmentUrl;

const getPlugins = (object: RepositoryPluginsObject) =>
  object.entries
    .filter((e) => e.type === "tree")
    .map((t) => {
      const name = t.name;
      const manifest: string | undefined = t.object.entries.filter(
        (c) => c.name === "plugin.json" && c.type === "blob",
      )[0].object.text;
      if (!manifest) return;
      try {
        return [name, JSON.parse(manifest)];
      } catch {
        return;
      }
    })
    .filter((e) => e !== undefined) as [string, PluginManifest][];

async function searchRepositories(token: string) {
  const req = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "shelter/plugin-scraper",
    },
    body: JSON.stringify({ query }),
  });
  if (!req.ok) throw new Error(`non-ok response status ${req.status}`);
  return req.json() as Promise<ResultType>;
}

export type PluginManifest = {
  name: string;
  author: string;
  description: string;
  hash?: string;
};
export type RepositoryData = {
  name: string;
  url: string;
  plugins: PluginManifest[];
};
export async function fetchSources(token: string): Promise<RepositoryData[]> {
  const result: RepositoryData[] = [];
  const search = await searchRepositories(token);
  for (const repository of search.data.search.nodes) {
    if (!repository.workflows || !hopefullyUsesLune(repository.workflows)) continue;
    const url = getEnvironmentUrl(repository.deployments);
    if (!url || repository.plugins == null) continue;
    const plugins = getPlugins(repository.plugins);
    if (plugins.length < 1) continue;

    result.push({
      name: repository.nameWithOwner,
      url,
      plugins: plugins.map(([name, manifest]) => ({
        ...manifest,
        url: new URL(name, url),
      })),
    });
  }
  return result;
}
