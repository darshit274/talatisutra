import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Apple touch icons shouldn't be transparent (iOS renders alpha as black), so this
// gets the classical theme's paper background (globals.css: oklch(from #f3f2f2 l c h))
// behind the same seal mark app/icon.tsx uses.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const notoSerifGujarati = readFile(join(process.cwd(), "assets/NotoSerifGujarati-Medium.woff"));

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F3F2F2",
        }}
      >
        <div
          style={{
            width: "76%",
            height: "76%",
            borderRadius: "50%",
            border: "7px solid #B68235",
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
              border: "5px solid #B68235",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "Noto Serif Gujarati",
                fontSize: 86,
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
