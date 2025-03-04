"use client";

import React, { useState, useEffect, useCallback, FormEvent } from "react";
import Terminal from "@/components/terminal";
import { ChatProps } from "@/types";
import Sidebar from "@/components/sidebar";
import { useClerk, useUser } from "@clerk/clerk-react";
import { PlaceholdersAndVanishInput } from "@/components/placeholders-and-vanish-input";

export default function Home() {
  const [openSidebar, setOpenSidebar] = useState(true);
  const [chats, setChats] = useState<ChatProps[]>([]);
  const [loading, setLoading] = useState({
    loadingChats: false,
    createChat: false,
    delete: false,
  });
  const [currentChatId, setCurrentChatId] = useState("");
  const [startInputValue, setStartInputValue] = useState("");
  const [start, setStart] = useState(false);

  const { user } = useUser();

  const { openSignIn } = useClerk();

  // create chat callback
  const handleCreateChat = useCallback(async () => {
    // to prevent the user from creating a new chat when he already
    // created one and did not used it:
    const unusedChat = chats.find((chat) => chat.messageCount === 0);
    if (unusedChat) {
      setCurrentChatId(unusedChat.id); // open the unused chat instead of creating a new one
    } else {
      setLoading((prev) => ({
        ...prev,
        createChat: true,
      }));
      try {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "New Chat",
          }),
        });

        if (!response.ok) {
          console.error("Failed to create chat");
          return;
        }

        const chat = await response.json();
        setChats((prev) => [
          {
            ...chat,
            messageCount: 0,
          },
          ...prev,
        ]);

        // set new chat as active
        setCurrentChatId(chat.id);
      } catch (error) {
        console.error("Error creating new chat: ", error);
      } finally {
        setLoading((prev) => ({
          ...prev,
          createChat: false,
        }));
      }
    }
  }, [chats]);

  // remove chat callback
  const handleRemoveChat = useCallback(
    async (chatId: string) => {
      setLoading((prev) => ({
        ...prev,
        delete: true,
      }));

      try {
        const response = await fetch("/api/chats", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chatId }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete chat");
        }

        // update state
        setChats((prevChats) => {
          const updatedChats = prevChats.filter((chat) => chat.id !== chatId);

          if (currentChatId === chatId) {
            setCurrentChatId(updatedChats.length > 0 ? updatedChats[0].id : "");
          }

          return updatedChats;
        });
      } catch (error) {
        console.error("Error deleting chat:", error);
      } finally {
        setLoading((prev) => ({
          ...prev,
          delete: false,
        }));
      }
    },
    [currentChatId],
  );

  // toggle sidebar callback
  const handleToggleSidebar = useCallback(() => {
    setOpenSidebar((prev) => !prev);
  }, []);

  // rename chat callback
  const handleRenameChat = useCallback(
    async (chatId: string, newValue: string) => {
      try {
        const response = await fetch("/api/chats", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, newName: newValue }),
        });

        if (!response.ok) {
          throw new Error("Failed to update chat name");
        }
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === chatId ? { ...chat, name: newValue } : chat,
          ),
        );
      } catch (error) {
        console.error("Error:", error);
      }
    },
    [],
  );

  const fetchChats = useCallback(async () => {
    setLoading((prev) => ({
      ...prev,
      loadingChats: true,
    }));
    try {
      const response = await fetch("/api/chats");

      if (!response.ok) {
        console.log("Failed to fetch chats");
        return;
      }

      const chatsData = await response.json();
      setChats(chatsData);

      if (!currentChatId && chatsData.length > 0) {
        setCurrentChatId(chatsData[0].id);
      }
    } catch (e) {
      console.log("error: ", e);
    } finally {
      setLoading((prev) => ({
        ...prev,
        loadingChats: false,
      }));
    }
  }, [currentChatId]);

  useEffect(() => {
    if (user && start) {
      fetchChats();
    }
  }, [user, start]);

  const handleStartPageInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { value } = e.target as HTMLInputElement;
    setStartInputValue(value);
  };

  const handleMessageSent = useCallback((chatId: string) => {
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? { ...chat, messageCount: chat.messageCount + 1 }
          : chat,
      ),
    );
  }, []);

  const handleStartPageFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // send the user to log in if they are not
    if (!user) {
      return openSignIn();
    }

    // open the terminal and side bar after the user submit the form with a prompt
    if (startInputValue && user) {
      setStart(true);
    }
  };

  return (
    <main
      className={
        "text-white h-[85dvh]  flex flex-row justify-center items-center sm:gap-2 md:gap-4 lg:gap-6 px-3 sm:px-4 md:px-8 xl:px-32"
      }
    >
      {start ? (
        <>
          {openSidebar && (
            <Sidebar
              open={openSidebar}
              chats={chats}
              loadingChat={loading.createChat}
              loadingChats={loading.loadingChats}
              disableRemoveChat={chats.length === 1}
              setActiveChatId={setCurrentChatId}
              currentChatId={currentChatId}
              handleRenameChat={handleRenameChat}
              handleRemoveChat={handleRemoveChat}
            />
          )}
          <Terminal
            chatId={currentChatId}
            starterMessage={startInputValue}
            openSidebar={openSidebar}
            disableRemoveChat={chats.length === 1 || loading.delete}
            // TODO: limit users to 8 chats
            disableCreateChat={loading.createChat}
            handleToggleSidebar={handleToggleSidebar}
            handleCreateChat={handleCreateChat}
            handleRemoveChat={handleRemoveChat}
            onMessageSent={handleMessageSent}
          />
        </>
      ) : (
        <section
          className={`w-full sm:w-[70%] mx-auto flex flex-col items-center gap-4`}
        >
          <h3 className="font-kanit text-[1.8rem] sm:text-4xl md:text-[3rem] font-bold text-center md:mb-2">
            What is the mession today?
          </h3>
          <PlaceholdersAndVanishInput
            placeholders={[
              "How does the `awk` command works ?",
              "What are the flags of `wc` command ?",
              "How to switch between users ?",
            ]}
            onChange={handleStartPageInputChange}
            onSubmit={handleStartPageFormSubmit}
          />
        </section>
      )}
    </main>
  );
}
