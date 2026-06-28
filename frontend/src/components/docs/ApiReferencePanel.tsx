import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

const SPEC_URL = "/v1/openapi.json";

export function ApiReferencePanel() {
  return (
    <ApiReferenceReact
      configuration={{
        url: SPEC_URL,
        darkMode: true,
        layout: "modern",
        theme: "purple",
        searchHotKey: "k",
        hideDownloadButton: false,
        hideModels: false,
        withDefaultFonts: false,
        defaultHttpClient: { targetKey: "curl", clientKey: "curl" },
        metaData: {
          title: "GemCheck API",
          description:
            "Crop trading cards and run AI pre-grades — same engine as the web app. Requires the Enterprise plan.",
        },
        customCss: `
          .scalar-app { --scalar-color-accent: #7c6cf6; }
          .introduction-description { max-width: 72ch; }
        `,
      }}
    />
  );
}
