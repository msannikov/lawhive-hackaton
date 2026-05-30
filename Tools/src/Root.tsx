import { Composition } from "remotion";
import { WorkflowDemo, WorkflowDemoClaude } from "./WorkflowDemo";
import { RecourseDemo } from "./RecourseDemo";
import { LawGunDemo } from "./LawGunDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LawGunDemo"
        component={LawGunDemo}
        durationInFrames={1185}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="RecourseDemo"
        component={RecourseDemo}
        durationInFrames={1110}
        fps={30}
        width={1920}
        height={1080}
      />
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
