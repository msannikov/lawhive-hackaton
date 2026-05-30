import { Composition } from "remotion";
import { WorkflowDemo } from "./WorkflowDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="WorkflowDemo"
      component={WorkflowDemo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
