This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 링크 공유 미리보기

`src/app/layout.tsx`의 Next.js Metadata API에서 공유 제목·설명·Open Graph·X(Twitter) 카드를 설정합니다. 사이트 이름은 **토플 유니온 | TOEFL Union**, 기준 도메인은 `https://toefl-union.vercel.app/`입니다. 기존 로고를 담은 `public/brand/share-card.png`(1200×630)를 공유 이미지로 사용합니다.

이 설정에는 추가 환경변수나 API 키가 필요하지 않습니다. 변경된 소스와 이미지를 Vercel에 다시 배포하세요. 도메인을 변경하면 `metadataBase`·`openGraph.url`과 공유 이미지의 표시 주소도 함께 수정합니다. 공유 이미지는 Windows에서 `scripts/build-share-image.ps1`로 다시 만들 수 있으며, 배포 시에는 생성된 PNG만 필요합니다.

[Vercel의 Open Graph 검사](https://vercel.com/docs/deployments/og-preview)에서 배포된 미리보기를 확인할 수 있습니다. 표시 형태는 각 공유 앱에 따라 다르고, 이미 공유한 링크는 앱의 캐시 때문에 갱신이 늦을 수 있습니다.
