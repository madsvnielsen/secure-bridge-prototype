import React from "react";
import { renderToString } from "react-dom/server";
import {
  BridgeStatusPage,
  type BridgeStatusProps,
} from "./BridgeStatusPage.tsx";

export function renderBridgeStatus(props: BridgeStatusProps): string {
  const markup = renderToString(<BridgeStatusPage {...props} />);
  return "<!doctype html>" + markup;
}
