import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import Logout from "./Logout";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { sendMessageRoute, recieveMessageRoute } from "../utils/APIRoutes";
import { decryptMessage, encryptMessage } from "../utils/encryption";

export default function ChatContainer({ currentChat, socket }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [sharedSecret, setSharedSecret] = useState("");

  useEffect(() => {
    const currentUser = JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY) || "{}"
    );
    const storageKey = `arkchat_shared_secret_${currentUser._id || "default"}_${currentChat?._id || "default"}`;
    const storedSecret = localStorage.getItem(storageKey) || "arkchat-shared-secret";
    localStorage.setItem(storageKey, storedSecret);
    setSharedSecret(storedSecret);
  }, [currentChat]);

  useEffect(async () => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
    const response = await axios.post(recieveMessageRoute, {
      from: data._id,
      to: currentChat._id,
    });

    const decryptedMessages = await Promise.all(
      response.data.map(async (message) => {
        try {
          const decrypted = await decryptMessage(message.message, sharedSecret);
          return { ...message, message: decrypted };
        } catch (error) {
          return { ...message, message: "[Unable to decrypt]" };
        }
      })
    );

    setMessages(decryptedMessages);
  }, [currentChat, sharedSecret]);

  useEffect(() => {
    const getCurrentChat = async () => {
      if (currentChat) {
        await JSON.parse(
          localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
        )._id;
      }
    };
    getCurrentChat();
  }, [currentChat]);

  const handleSecretChange = (event) => {
    const value = event.target.value;
    const currentUser = JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY) || "{}"
    );
    const storageKey = `arkchat_shared_secret_${currentUser._id || "default"}_${currentChat?._id || "default"}`;
    const nextSecret = value || "arkchat-shared-secret";
    localStorage.setItem(storageKey, nextSecret);
    setSharedSecret(nextSecret);
  };

  const handleSendMsg = async (msg) => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
    const encrypted = await encryptMessage(msg, sharedSecret);

    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: data._id,
      msg: encrypted,
    });
    await axios.post(sendMessageRoute, {
      from: data._id,
      to: currentChat._id,
      message: encrypted,
    });

    const msgs = [...messages];
    msgs.push({ fromSelf: true, message: msg });
    setMessages(msgs);
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("msg-recieve", async (msg) => {
        try {
          const decrypted = await decryptMessage(msg, sharedSecret);
          setArrivalMessage({ fromSelf: false, message: decrypted });
        } catch (error) {
          setArrivalMessage({ fromSelf: false, message: "[Unable to decrypt]" });
        }
      });
    }
  }, [sharedSecret]);

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
            <img
              src={currentChat.avatarImage}
              alt=""
            />
          </div>
          <div className="username">
            <h3>{currentChat.username}</h3>
          </div>
        </div>
        <div className="chat-controls">
          <input
            type="password"
            value={sharedSecret}
            onChange={handleSecretChange}
            placeholder="Shared secret"
            aria-label="Shared secret"
          />
          <Logout />
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((message) => {
          return (
            <div ref={scrollRef} key={uuidv4()}>
              <div
                className={`message ${
                  message.fromSelf ? "sended" : "recieved"
                }`}
              >
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
    border-radius: 5px;
    background-color: rgb(76, 46, 209);
    align-items: center;
    padding: 0 2rem;
    .chat-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      input {
        border: none;
        border-radius: 0.5rem;
        padding: 0.4rem 0.7rem;
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
        &::placeholder {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      .avatar {
        img {
          height: 3rem;
        }
      }
      .username {
        h3 {
          color: white;
        }
      }
    }
  }
  .chat-messages {
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }
    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 1.1rem;
        border-radius: 1rem;
        color: #d1d1d1;
        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 70%;
        }
      }
    }
    .sended {
      justify-content: flex-end;
      .content {
        background-color: rgb(58, 55, 78);
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background-color: rgb(76, 46, 209);
      }
    }
  }
  .gpNLio{
  	background-color: rgb(210, 32, 39);
  }
`;
