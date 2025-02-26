import ShelterSvg from "shelter-assets/svg/banner.svg";

interface ShelterLogoProps {
  width?: number;
  height?: number;
}

export default (props: ShelterLogoProps) => (
  <img
    style={{ display: "inline", "border-radius": "0.725rem", "user-select": "none" }}
    src={ShelterSvg}
    width={props.width || 225}
    height={props.height ?? 80.5}
    draggable={false}
  />
);
