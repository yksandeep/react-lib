import React from "react";
import { Card, CardLink } from "./index.styled";

/**
 * IDemo Interface
 * @interface
 * @prop {string}  sampleTextProp
 */
export interface IDemo {
  sampleTextProp: string;
}

/**
 * Demo
 *
 * @prop string variant
 * @prop {string} sampleTextProp
 * @return {React.FC} Demo Component
 *
 * @component
 * @example
 * return(
 *    <Demo sampleTextProp="Demo"/>
 * )
 */
export const Demo: React.FC<IDemo> = ({ sampleTextProp }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#fff",
        padding: "20px",
      }}
    >
      <p>Card with DIV HTML Tag</p>
      <Card>Demo Component </Card>
      <p>Card with Anchor link (a) HTML Tag</p>
      <CardLink href="#">{sampleTextProp} Link</CardLink>
    </div>
  );
};

export default Demo;
