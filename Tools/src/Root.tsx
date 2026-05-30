import { Composition } from "remotion";
import { WorkflowDemo, WorkflowDemoClaude } from "./WorkflowDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WorkflowDemo"
        component={WorkflowDemo}
        durationInFrames={1230}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="WorkflowDemoClaude"
        component={WorkflowDemoClaude}
        durationInFrames={1230}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
