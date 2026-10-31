import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Same seal mark as the header's Wordmark (app/(marketing)/_components/marketing-header.tsx)
// — two concentric rings around a centered Gujarati "ત", in the classical theme's
// --primary brand color (globals.css: oklch(from #b68235 l c h)).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const notoSerifGujarati = readFile(join(process.cwd(), "assets/NotoSerifGujarati-Medium.woff"));

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "94%",
            height: "94%",
            borderRadius: "50%",
            border: "1.8px solid #B68235",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "68%",
              height: "68%",
              borderRadius: "50%",
              border: "1.3px solid #B68235",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "Noto Serif Gujarati",
                fontSize: 17,
                color: "#B68235",
                lineHeight: 1,
              }}
            >
              ત
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Serif Gujarati",
          data: await notoSerifGujarati,
          style: "normal",
          weight: 500,
        },
      ],
    },
  );
}
