import mixpanel from "mixpanel-browser";
export function initMixpanel() {
  mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "", {
    debug: true,
  });
}