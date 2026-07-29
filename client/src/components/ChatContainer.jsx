// client/src/components/ChatContainer.jsx
import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { sendMessageRoute, recieveMessageRoute, host } from "../utils/APIRoutes";
import { encryptMessageBase64, decryptMessageBase64, generateKeyPairBase64 } from "../utils/crypto";

export default function ChatContainer({ currentChat, socket }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);

  // Ensure E2EE keys exist for this client and publicKey uploaded
  useEffect(() => {
    const initKeys = async () => {
      const localUser = await JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
      if (!localUser) return;
      let keys = JSON.parse(localStorage.getItem("e2ee_keys"));
      if (!keys) {
        keys = generateKeyPairBase64();
        // WARNING: secretKey in localStorage is convenient but vulnerable to XSS.
        localStorage.setItem("e2ee_keys", JSON.stringify(keys));
        // Upload public key to server
        try {
          await axios.post(`${host}/api/auth/setpubkey/${localUser._id}`, { publicKey: keys.publicKey });
        } catch (e) {
          console.error("Failed to upload public key:", e);
        }
      }
    };
    initKeys();
  }, []);

  useEffect(async () => {
    if (!currentChat) return;
    const data = await JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
    const response = await axios.post(recieveMessageRoute, {
      from: data._id,
      to: currentChat._id,
    });

    // decrypt each message
    const keys = JSON.parse(localStorage.getItem("e2ee_keys"));
    const decrypted = response.data.map((msg) => {
      // msg.message is an object {ciphertext, nonce, senderPublicKey}
      const contentObj = msg.message;
      let plaintext = "[could not decrypt]";
      if (contentObj && keys) {
        const dec = decryptMessageBase64(
          contentObj.ciphertext,
          contentObj.nonce,
          contentObj.senderPublicKey,
          keys.secretKey
        );
        plaintext = dec || plaintext;
      }
      return { fromSelf: msg.fromSelf, message: plaintext };
    });

    setMessages(decrypted);
  }, [currentChat]);

  useEffect(() => {
    const getCurrentChat = async () => {
      if (currentChat) {
        await JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY))._id;
      }
    };
    getCurrentChat();
  }, [currentChat]);

  const handleSendMsg = async (msg) => {
    const data = await JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
    const keys = JSON.parse(localStorage.getItem("e2ee_keys"));
    if (!keys) {
      console.error("No E2EE keys available.");
      return;
    }
    const recipientPub = currentChat.publicKey;
    if (!recipientPub) {
      console.error("Recipient public key not available. Cannot encrypt.");
      return;
    }

    const encrypted = encryptMessageBase64(msg, keys.secretKey, recipientPub);

    // Send via socket (encrypted payload)
    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: data._id,
      msg: {
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        senderPublicKey: keys.publicKey,
      },
    });

    // Store ciphertext on server
    await axios.post(sendMessageRoute, {
      from: data._id,
      to: currentChat._id,
      message: {
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        senderPublicKey: keys.publicKey,
      },
    });

    // Update local UI with plaintext immediately
    const msgs = [...messages];
    msgs.push({ fromSelf: true, message: msg });
    setMessages(msgs);
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("msg-recieve", (msgObj) => {
        try {
          const keys = JSON.parse(localStorage.getItem("e2ee_keys"));
          if (!keys) {
            setArrivalMessage({ fromSelf: false, message: "[encrypted message]" });
            return;
          }
          const contentObj = msgObj; // {ciphertext, nonce, senderPublicKey}
          const plaintext = decryptMessageBase64(
            contentObj.ciphertext,
            contentObj.nonce,
            contentObj.senderPublicKey,
            keys.secretKey
          );
          setArrivalMessage({ fromSelf: false, message: plaintext || "[could not decrypt]" });
        } catch (e) {
          console.error("Error decrypting incoming message:", e);
          setArrivalMessage({ fromSelf: false, message: "[could not decrypt]" });
        }
      });
    }
  }, []);

  useEffect(() => {
    arrivalMessage && setMessages((prev) => [...prev, arrivalMessage]);
  }, [arrivalMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <div className="avatar">
            <img src={currentChat.avatarImage} alt="" />
          </div>
          <div className="username">
            <h3>{currentChat.username}</h3>
          </div>
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((message) => {
          return (
            <div ref={scrollRef} key={uuidv4()}>
              <div className={`message ${message.fromSelf ? "sended" : "recieved"}`}>
                <div className="content ">
                  <p>{message.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ChatInput handleSendMsg={handleSendMsg} />
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    grid-template-rows: 15% 70% 15%;
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
  }
`;