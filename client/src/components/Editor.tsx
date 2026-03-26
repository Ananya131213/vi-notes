import { useState } from "react";

const Editor = () => {
  const [text, setText] = useState("");

  return (
    <div style={{ padding: "20px" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start writing..."
        style={{
          width: "100%",
          height: "80vh",
          fontSize: "16px",
          lineHeight: "1.5",
          border: "none",
          outline: "none",
          resize: "none",
        }}
      />
    </div>
  );
};

export default Editor;