import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CatModal({ open, onOpenChange }: Props) {
  const { resolvedTheme } = useTheme();
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const bubbleFill = resolvedTheme === "light" ? "#FFF4D7" : "#FFFAEB";

  useEffect(() => {
    if (!open) {
      setBubbleVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!bubbleVisible) return;
    const timer = window.setTimeout(() => setBubbleVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [bubbleVisible]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-4 border-border bg-card text-foreground font-pixel">
        <DialogHeader>
          <DialogTitle className="text-lg">🐱 Le Cat says hi!</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setBubbleVisible(true)}
              className="border-4 border-border bg-background hover:bg-muted transition shadow-lg"
              title="Click to see what Le Cat says"
            >
              <img
                src="/assets/lechat-gif.gif"
                alt="Pixel cat mascot"
                className="w-56 h-56 object-cover"
                loading="lazy"
              />
            </button>
            <div
              className={cn(
                "pointer-events-none absolute -right-12 -top-8 transition-all duration-200",
                bubbleVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-3"
              )}
            >
              {bubbleVisible && <SpeechBubble fill={bubbleFill} />}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Tap the cat to reveal its secret message. The bubble fades after a few seconds.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SpeechBubble({ fill }: { fill: string }) {
  return (
    <svg
      width="150"
      height="107"
      viewBox="0 0 150 107"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]"
    >
      <g clipPath="url(#clip0_805_6247)">
        <path d="M21.5285 0.138443H10.835" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M32.2219 0.138443H21.5285" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M42.9182 0.138443H32.2219" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M53.6117 0.138443H42.9182" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M64.3051 0.138443H53.6117" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M75.0014 0.138443H64.3051" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M85.6949 0.138443H75.0014" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M96.3883 0.138443H85.6949" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M107.082 0.138443H96.3883" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M117.778 0.138443H107.082" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M128.472 0.138443H117.778" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M139.165 0.138443H128.472" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M21.5285 0.138443H10.835V10.8099H21.5285V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M32.2219 0.138443H21.5285V10.8099H32.2219V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M42.9182 0.138443H32.2219V10.8099H42.9182V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M53.6117 0.138443H42.9182V10.8099H53.6117V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M64.3051 0.138443H53.6117V10.8099H64.3051V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M75.0014 0.138443H64.3051V10.8099H75.0014V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M85.6949 0.138443H75.0014V10.8099H85.6949V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M96.3883 0.138443H85.6949V10.8099H96.3883V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M107.082 0.138443H96.3883V10.8099H107.082V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M117.778 0.138443H107.082V10.8099H117.778V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M128.472 0.138443H117.778V10.8099H128.472V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M139.165 0.138443H128.472V10.8099H139.165V0.138443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 10.8099V21.4842" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 10.8099H0.138733V21.4842H10.835V10.8099Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 10.8099H139.165V21.4842H149.861V10.8099Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 21.4842V10.8099" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 21.4842V32.1557" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 21.4842H0.138733V32.1557H10.835V21.4842Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 21.4842H139.165V32.1557H149.861V21.4842Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 32.1557V21.4842" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 32.1557V42.8271" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 32.1557H0.138733V42.8271H10.835V32.1557Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 32.1557H139.165V42.8271H149.861V32.1557Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 42.8271V32.1557" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 42.8271V53.5014" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 42.8271H0.138733V53.5014H10.835V42.8271Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 42.8271H139.165V53.5014H149.861V42.8271Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 53.5014V42.8271" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 53.5014V64.1729" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 53.5014H0.138733V64.1729H10.835V53.5014Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 53.5014H139.165V64.1729H149.861V53.5014Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 64.1729V53.5014" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 64.1729V74.8443" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 64.1729H0.138733V74.8443H10.835V64.1729Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 64.1729H139.165V74.8443H149.861V64.1729Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M149.861 74.8443V64.1729" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 74.8443V85.5158" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 74.8443H0.138733V85.5158H10.835V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M42.9182 74.8443H32.2219V85.5158H42.9182V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M53.6117 74.8443H42.9182V85.5158H53.6117V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M64.3051 74.8443H53.6117V85.5158H64.3051V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M75.0014 74.8443H64.3051V85.5158H75.0014V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M85.6949 74.8443H75.0014V85.5158H85.6949V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M96.3883 74.8443H85.6949V85.5158H96.3883V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M107.082 74.8443H96.3883V85.5158H107.082V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M117.778 74.8443H107.082V85.5158H117.778V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M128.472 74.8443H117.778V85.5158H128.472V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M139.165 74.8443H128.472V85.5158H139.165V74.8443Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M0.138733 85.5158V96.1901" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path d="M10.835 85.5158H0.138733V96.1901H10.835V85.5158Z" fill="#1D1D1B" stroke="#1D1D1B" strokeMiterlimit="10" />
        <path
          d="M139.165 10.8099V74.8443H32.2219V85.5158H21.5285V96.1901H10.835V10.8099H139.165Z"
          fill={fill}
          stroke="#1D1D1B"
          strokeMiterlimit="10"
        />
        <path
          d="M23.7578 56V35.2578H26.9023V38.168C27.5534 37.1523 28.4193 36.3385 29.5 35.7266C30.5807 35.1016 31.8112 34.7891 33.1914 34.7891C34.7279 34.7891 35.9844 35.1081 36.9609 35.7461C37.9505 36.3841 38.6471 37.276 39.0508 38.4219C40.6914 36 42.8268 34.7891 45.457 34.7891C47.5143 34.7891 49.0964 35.362 50.2031 36.5078C51.3099 37.6406 51.8633 39.3919 51.8633 41.7617V56H48.3672V42.9336C48.3672 41.5273 48.25 40.5182 48.0156 39.9062C47.7943 39.2812 47.3841 38.7799 46.7852 38.4023C46.1862 38.0247 45.4831 37.8359 44.6758 37.8359C43.2174 37.8359 42.0065 38.3242 41.043 39.3008C40.0794 40.2643 39.5977 41.8138 39.5977 43.9492V56H36.082V42.5234C36.082 40.9609 35.7956 39.7891 35.2227 39.0078C34.6497 38.2266 33.7122 37.8359 32.4102 37.8359C31.4206 37.8359 30.5026 38.0964 29.6562 38.6172C28.8229 39.138 28.2174 39.8997 27.8398 40.9023C27.4622 41.9049 27.2734 43.3503 27.2734 45.2383V56H23.7578Z"
          fill="black"
        />
        <path
          d="M71.2773 49.3203L74.9102 49.7695C74.3372 51.8919 73.276 53.5391 71.7266 54.7109C70.1771 55.8828 68.1979 56.4688 65.7891 56.4688C62.7552 56.4688 60.3464 55.5378 58.5625 53.6758C56.7917 51.8008 55.9062 49.1771 55.9062 45.8047C55.9062 42.3151 56.8047 39.6068 58.6016 37.6797C60.3984 35.7526 62.7292 34.7891 65.5938 34.7891C68.3672 34.7891 70.6328 35.7331 72.3906 37.6211C74.1484 39.5091 75.0273 42.1654 75.0273 45.5898C75.0273 45.7982 75.0208 46.1107 75.0078 46.5273H59.5391C59.6693 48.806 60.3138 50.5508 61.4727 51.7617C62.6315 52.9727 64.0768 53.5781 65.8086 53.5781C67.0977 53.5781 68.1979 53.2396 69.1094 52.5625C70.0208 51.8854 70.7435 50.8047 71.2773 49.3203ZM59.7344 43.6367H71.3164C71.1602 41.8919 70.7174 40.5833 69.9883 39.7109C68.8685 38.3568 67.4167 37.6797 65.6328 37.6797C64.0182 37.6797 62.6576 38.2201 61.5508 39.3008C60.457 40.3815 59.8516 41.8268 59.7344 43.6367Z"
          fill="black"
        />
        <path
          d="M78.0352 45.6289C78.0352 41.7878 79.1029 38.9427 81.2383 37.0938C83.0221 35.5573 85.1966 34.7891 87.7617 34.7891C90.6133 34.7891 92.944 35.7266 94.7539 37.6016C96.5638 39.4635 97.4688 42.0417 97.4688 45.3359C97.4688 48.0052 97.0651 50.1081 96.2578 51.6445C95.4635 53.168 94.2982 54.3529 92.7617 55.1992C91.2383 56.0456 89.5716 56.4688 87.7617 56.4688C84.8581 56.4688 82.5078 55.5378 80.7109 53.6758C78.9271 51.8138 78.0352 49.1315 78.0352 45.6289ZM81.6484 45.6289C81.6484 48.2852 82.2279 50.2773 83.3867 51.6055C84.5456 52.9206 86.0039 53.5781 87.7617 53.5781C89.5065 53.5781 90.9583 52.9141 92.1172 51.5859C93.276 50.2578 93.8555 48.2331 93.8555 45.5117C93.8555 42.9466 93.2695 41.0065 92.0977 39.6914C90.9388 38.3633 89.4935 37.6992 87.7617 37.6992C86.0039 37.6992 84.5456 38.3568 83.3867 39.6719C82.2279 40.987 81.6484 42.9727 81.6484 45.6289Z"
          fill="black"
        />
        <path
          d="M105.438 56L99.0898 35.2578H102.723L107.254 51.6836C107.306 51.4622 107.664 50.0365 108.328 47.4062L111.629 35.2578H115.242L118.348 47.2891L119.383 51.2539L120.574 47.25L124.129 35.2578H127.547L121.062 56H117.41L114.109 43.5781L113.309 40.043L109.109 56H105.438Z"
          fill="black"
        />
      </g>
      <defs>
        <clipPath id="clip0_805_6247">
          <rect width="150" height="107" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
