import RewardCheckoutRules from "./RewardCheckoutRules";
import WheelCampaignMetrics from "./WheelCampaignMetrics";
import WheelCampaignWorkspace from "./WheelCampaignWorkspace";

export default function PromotionsWheelPage() {
  return (
    <>
      <WheelCampaignMetrics />
      <WheelCampaignWorkspace />
      <RewardCheckoutRules />
    </>
  );
}
