import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from "socket.io-client";
import axios from "axios";
import { MessageSquare, Users, Hash, Settings, LogOut, Plus, X, Edit, Trash2, UserPlus, UserMinus, Bell } from 'lucide-react';
import './App.css';

const API_BASE_URL = "http://localhost:8000/api";

// Define interfaces for our data types
interface User {
  id: string;
  fullName?: string;
  email: string;
  mobileNumber?: string;
  avatar?: string;
  status?: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  type: "private" | "public" | "channel";
  channelId?: string;
  created_at: string;
  updated_at?: string;
  sender?: User;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  created_at: string;
  members?: User[];
  isPrivate: boolean;
}

interface Notification {
  id: string;
  message: string;
  type: "message" | "channel" | "system";
  read: boolean;
  timestamp: Date;
  senderId?: string;
  channelId?: string;
}

const App: React.FC = () => {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  // Register form states
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Workspace states
  const [activeSection, setActiveSection] = useState<"messages" | "users" | "channels">("messages");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [publicMessages, setPublicMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Channel states
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelMessages, setChannelMessages] = useState<Message[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [isChannelPrivate, setIsChannelPrivate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDeleteChannelConfirm, setShowDeleteChannelConfirm] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");

  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Backend connection test
  const [backendStatus, setBackendStatus] = useState("Connecting to backend...");

  // Initialize socket connection
  useEffect(() => {
    const testBackendConnection = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/test`);
        setBackendStatus(response.data.message);
      } catch (error) {
        setBackendStatus("Error connecting to backend");
        console.error("Backend connection error:", error);
      }
    };

    testBackendConnection();

    // Check if user is already logged in
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("currentUser");

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        setIsLoggedIn(true);
        setCurrentUser(parsedUser);
        
        // Initialize socket connection
        const newSocket = io("http://localhost:8000", {
          auth: { token },
          transports: ["websocket"],
        });

        newSocket.on("connect", () => {
          setConnectionStatus("Connected");
          console.log("Socket connected");
        });

        newSocket.on("disconnect", () => {
          setConnectionStatus("Disconnected");
          console.log("Socket disconnected");
        });

        newSocket.on("newMessage", (message: Message) => {
          console.log("New message received:", message);
          handleNewMessage(message);
          
          // Add notification for new message if not from current user
          if (message.senderId !== parsedUser.id) {
            const sender = message.sender?.fullName || message.sender?.email || "Someone";
            let notificationMessage = "";
            
            if (message.type === "private") {
              notificationMessage = `${sender} sent you a private message`;
            } else if (message.type === "channel") {
              const channelName = channels.find(c => c.id === message.channelId)?.name || "a channel";
              notificationMessage = `${sender} posted in #${channelName}`;
            } else {
              notificationMessage = `${sender} posted a public message`;
            }
            
            addNotification({
              id: Date.now().toString(),
              message: notificationMessage,
              type: "message",
              read: false,
              timestamp: new Date(),
              senderId: message.senderId,
              channelId: message.channelId
            });
          }
        });

        newSocket.on("messageUpdated", (message: Message) => {
          console.log("Message updated:", message);
          handleMessageUpdate(message);
        });

        newSocket.on("messageDeleted", ({ messageId }: { messageId: string }) => {
          console.log("Message deleted:", messageId);
          handleMessageDelete(messageId);
        });
        
        // Channel events
        newSocket.on("channelCreated", (channel: Channel) => {
          console.log("Channel created:", channel);
          setChannels(prev => [...prev, channel]);
          addNotification({
            id: Date.now().toString(),
            message: `New channel #${channel.name} was created`,
            type: "channel",
            read: false,
            timestamp: new Date(),
            channelId: channel.id
          });
        });
        
        newSocket.on("channelUpdated", (channel: Channel) => {
          console.log("Channel updated:", channel);
          setChannels(prev => prev.map(c => c.id === channel.id ? channel : c));
          
          if (selectedChannel?.id === channel.id) {
            setSelectedChannel(channel);
          }
          
          addNotification({
            id: Date.now().toString(),
            message: `Channel #${channel.name} was updated`,
            type: "channel",
            read: false,
            timestamp: new Date(),
            channelId: channel.id
          });
        });
        
        newSocket.on("channelDeleted", ({ channelId }: { channelId: string }) => {
          console.log("Channel deleted:", channelId);
          const deletedChannel = channels.find(c => c.id === channelId);
          
          setChannels(prev => prev.filter(c => c.id !== channelId));
          
          if (selectedChannel?.id === channelId) {
            setSelectedChannel(null);
            setChannelMessages([]);
            setActiveSection("messages");
          }
          
          addNotification({
            id: Date.now().toString(),
            message: `Channel #${deletedChannel?.name || "unknown"} was deleted`,
            type: "channel",
            read: false,
            timestamp: new Date()
          });
        });
        
        newSocket.on("channelMemberAdded", ({ channelId, user }: { channelId: string, user: User }) => {
          console.log("Member added to channel:", channelId, user);
          
          // Update channels list
          setChannels(prev => prev.map(channel => {
            if (channel.id === channelId) {
              return {
                ...channel,
                members: [...(channel.members || []), user]
              };
            }
            return channel;
          }));
          
          // Update selected channel if it's the one being modified
          if (selectedChannel?.id === channelId) {
            setSelectedChannel(prev => {
              if (!prev) return null;
              return {
                ...prev,
                members: [...(prev.members || []), user]
              };
            });
          }
          
          // Add notification
          const channelName = channels.find(c => c.id === channelId)?.name || "a channel";
          addNotification({
            id: Date.now().toString(),
            message: `${user.fullName || user.email} was added to #${channelName}`,
            type: "channel",
            read: false,
            timestamp: new Date(),
            channelId: channelId
          });
        });
        
        newSocket.on("channelMemberRemoved", ({ channelId, userId }: { channelId: string, userId: string }) => {
          console.log("Member removed from channel:", channelId, userId);
          
          // Get user info before removing
          const removedUser = users.find(u => u.id === userId);
          
          // Update channels list
          setChannels(prev => prev.map(channel => {
            if (channel.id === channelId) {
              return {
                ...channel,
                members: (channel.members || []).filter(member => member.id !== userId)
              };
            }
            return channel;
          }));
          
          // Update selected channel if it's the one being modified
          if (selectedChannel?.id === channelId) {
            setSelectedChannel(prev => {
              if (!prev) return null;
              return {
                ...prev,
                members: (prev.members || []).filter(member => member.id !== userId)
              };
            });
          }
          
          // Add notification
          const channelName = channels.find(c => c.id === channelId)?.name || "a channel";
          const userName = removedUser?.fullName || removedUser?.email || "A user";
          
          addNotification({
            id: Date.now().toString(),
            message: `${userName} was removed from #${channelName}`,
            type: "channel",
            read: false,
            timestamp: new Date(),
            channelId: channelId
          });
        });

        setSocket(newSocket);

        // Load initial data
        fetchUsers();
        fetchPublicMessages();
        fetchChannels();

        return () => {
          newSocket.disconnect();
        };
      } catch (err) {
        console.error("Error parsing user data from localStorage", err);
        localStorage.removeItem("currentUser");
      }
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, publicMessages, channelMessages]);

  // Update unread notification count
  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.read).length;
    setUnreadNotifications(unreadCount);
  }, [notifications]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Add a new notification
  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep only the latest 50 notifications
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Handle new message from socket
  const handleNewMessage = (message: Message) => {
    if (message.type === "public") {
      setPublicMessages(prev => [...prev, message]);
    } else if (message.type === "private") {
      if (
        selectedUser &&
        ((message.senderId === currentUser?.id && message.receiverId === selectedUser.id) ||
        (message.senderId === selectedUser.id && message.receiverId === currentUser?.id))
      ) {
        setMessages(prev => [...prev, message]);
      }
    } else if (message.type === "channel" && selectedChannel && message.channelId === selectedChannel.id) {
      setChannelMessages(prev => [...prev, message]);
    }
  };

  // Handle message update from socket
  const handleMessageUpdate = (updatedMessage: Message) => {
    if (updatedMessage.type === "public") {
      setPublicMessages(prev =>
        prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
      );
    } else if (updatedMessage.type === "private") {
      setMessages(prev =>
        prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
      );
    } else if (updatedMessage.type === "channel") {
      setChannelMessages(prev =>
        prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
      );
    }
  };

  // Handle message deletion from socket
  const handleMessageDelete = (messageId: string) => {
    setPublicMessages(prev => prev.filter(msg => msg.id !== messageId));
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    setChannelMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  // Authentication functions
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        fullName,
        mobileNumber,
        email,
        password
      });

      console.log("Registration successful:", response.data);
      setIsRegistering(false);
      setAuthError("");
      // Clear form fields after successful registration
      setFullName("");
      setMobileNumber("");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      console.error("Registration error:", error);
      setAuthError(error.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      if (!response.data || !response.data.data) {
        throw new Error("Invalid response format");
      }

      const { token, user } = response.data.data;

      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(user));

      setCurrentUser(user);
      setIsLoggedIn(true);

      // Initialize socket connection
      const newSocket = io("http://localhost:8000", {
        auth: { token },
        transports: ["websocket"],
      });

      newSocket.on("connect", () => {
        setConnectionStatus("Connected");
        console.log("Socket connected");
      });

      newSocket.on("disconnect", () => {
        setConnectionStatus("Disconnected");
        console.log("Socket disconnected");
      });

      newSocket.on("newMessage", (message: Message) => {
        console.log("New message received:", message);
        handleNewMessage(message);
        
        // Add notification for new message if not from current user
        if (message.senderId !== user.id) {
          const sender = message.sender?.fullName || message.sender?.email || "Someone";
          let notificationMessage = "";
          
          if (message.type === "private") {
            notificationMessage = `${sender} sent you a private message`;
          } else if (message.type === "channel") {
            const channelName = channels.find(c => c.id === message.channelId)?.name || "a channel";
            notificationMessage = `${sender} posted in #${channelName}`;
          } else {
            notificationMessage = `${sender} posted a public message`;
          }
          
          addNotification({
            id: Date.now().toString(),
            message: notificationMessage,
            type: "message",
            read: false,
            timestamp: new Date(),
            senderId: message.senderId,
            channelId: message.channelId
          });
        }
      });

      newSocket.on("messageUpdated", (message: Message) => {
        console.log("Message updated:", message);
        handleMessageUpdate(message);
      });

      newSocket.on("messageDeleted", ({ messageId }: { messageId: string }) => {
        console.log("Message deleted:", messageId);
        handleMessageDelete(messageId);
      });
      
      // Channel events
      newSocket.on("channelCreated", (channel: Channel) => {
        console.log("Channel created:", channel);
        setChannels(prev => [...prev, channel]);
        addNotification({
          id: Date.now().toString(),
          message: `New channel #${channel.name} was created`,
          type: "channel",
          read: false,
          timestamp: new Date(),
          channelId: channel.id
        });
      });
      
      newSocket.on("channelUpdated", (channel: Channel) => {
        console.log("Channel updated:", channel);
        setChannels(prev => prev.map(c => c.id === channel.id ? channel : c));
        
        if (selectedChannel?.id === channel.id) {
          setSelectedChannel(channel);
        }
        
        addNotification({
          id: Date.now().toString(),
          message: `Channel #${channel.name} was updated`,
          type: "channel",
          read: false,
          timestamp: new Date(),
          channelId: channel.id
        });
      });
      
      newSocket.on("channelDeleted", ({ channelId }: { channelId: string }) => {
        console.log("Channel deleted:", channelId);
        const deletedChannel = channels.find(c => c.id === channelId);
        
        setChannels(prev => prev.filter(c => c.id !== channelId));
        
        if (selectedChannel?.id === channelId) {
          setSelectedChannel(null);
          setChannelMessages([]);
          setActiveSection("messages");
        }
        
        addNotification({
          id: Date.now().toString(),
          message: `Channel #${deletedChannel?.name || "unknown"} was deleted`,
          type: "channel",
          read: false,
          timestamp: new Date()
        });
      });
      
      newSocket.on("channelMemberAdded", ({ channelId, user }: { channelId: string, user: User }) => {
        console.log("Member added to channel:", channelId, user);
        
        // Update channels list
        setChannels(prev => prev.map(channel => {
          if (channel.id === channelId) {
            return {
              ...channel,
              members: [...(channel.members || []), user]
            };
          }
          return channel;
        }));
        
        // Update selected channel if it's the one being modified
        if (selectedChannel?.id === channelId) {
          setSelectedChannel(prev => {
            if (!prev) return null;
            return {
              ...prev,
              members: [...(prev.members || []), user]
            };
          });
        }
        
        // Add notification
        const channelName = channels.find(c => c.id === channelId)?.name || "a channel";
        addNotification({
          id: Date.now().toString(),
          message: `${user.fullName || user.email} was added to #${channelName}`,
          type: "channel",
          read: false,
          timestamp: new Date(),
          channelId: channelId
        });
      });
      
      newSocket.on("channelMemberRemoved", ({ channelId, userId }: { channelId: string, userId: string }) => {
        console.log("Member removed from channel:", channelId, userId);
        
        // Get user info before removing
        const removedUser = users.find(u => u.id === userId);
        
        // Update channels list
        setChannels(prev => prev.map(channel => {
          if (channel.id === channelId) {
            return {
              ...channel,
              members: (channel.members || []).filter(member => member.id !== userId)
            };
          }
          return channel;
        }));
        
        // Update selected channel if it's the one being modified
        if (selectedChannel?.id === channelId) {
          setSelectedChannel(prev => {
            if (!prev) return null;
            return {
              ...prev,
              members: (prev.members || []).filter(member => member.id !== userId)
            };
          });
        }
        
        // Add notification
        const channelName = channels.find(c => c.id === channelId)?.name || "a channel";
        const userName = removedUser?.fullName || removedUser?.email || "A user";
        
        addNotification({
          id: Date.now().toString(),
          message: `${userName} was removed from #${channelName}`,
          type: "channel",
          read: false,
          timestamp: new Date(),
          channelId: channelId
        });
      });

      setSocket(newSocket);

      // Load initial data
      fetchUsers();
      fetchPublicMessages();
      fetchChannels();
    } catch (error: any) {
      console.error("Login error:", error);
      setAuthError(
        error.response?.data?.message || "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUsers([]);
    setMessages([]);
    setPublicMessages([]);
    setChannels([]);
    setChannelMessages([]);
    setSelectedUser(null);
    setSelectedChannel(null);
    setNotifications([]);
  };

  // API functions
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No token found in localStorage");
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data && response.data.data && response.data.data.users) {
        setUsers(response.data.data.users.filter((user: User) => user.id !== currentUser?.id));
      } else {
        console.error("Unexpected API response format:", response.data);
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const fetchPublicMessages = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.data) {
        setPublicMessages(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching public messages:", error);
    }
  };

  const fetchDirectMessages = async (userId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.data) {
        setMessages(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching direct messages:", error);
    }
  };

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.data) {
        setChannels(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
  };

  const fetchChannelMessages = async (channelId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.data) {
        setChannelMessages(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching channel messages:", error);
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/channels`, 
        {
          name: newChannelName,
          description: newChannelDescription,
          isPrivate: isChannelPrivate
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data && response.data.data) {
        setChannels([...channels, response.data.data]);
        setShowCreateChannel(false);
        setNewChannelName("");
        setNewChannelDescription("");
        setIsChannelPrivate(false);
        
        // Add notification
        addNotification({
          id: Date.now().toString(),
          message: `You created a new channel #${response.data.data.name}`,
          type: "channel",
          read: true, // Mark as read since the user created it
          timestamp: new Date(),
          channelId: response.data.data.id
        });
      }
    } catch (error) {
      console.error("Error creating channel:", error);
    }
  };

  const deleteChannel = async () => {
    if (!selectedChannel) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE_URL}/channels/${selectedChannel.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Remove from channels list
      setChannels(channels.filter(c => c.id !== selectedChannel.id));
      
      // Reset selected channel
      setSelectedChannel(null);
      setChannelMessages([]);
      setActiveSection("messages");
      setShowDeleteChannelConfirm(false);
      
      // Add notification
      addNotification({
        id: Date.now().toString(),
        message: `You deleted channel #${selectedChannel.name}`,
        type: "channel",
        read: true, // Mark as read since the user deleted it
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error deleting channel:", error);
    }
  };

  const addMemberToChannel = async (channelId: string, userId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/channels/${channelId}/members`,
        { userId },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Refresh channel data
      if (selectedChannel && selectedChannel.id === channelId) {
        const updatedChannel = { ...selectedChannel };
        const userToAdd = users.find(u => u.id === userId);
        
        if (userToAdd && updatedChannel.members) {
          updatedChannel.members = [...updatedChannel.members, userToAdd];
          setSelectedChannel(updatedChannel);
        }
      }
      
      // Refresh channels list
      fetchChannels();
    } catch (error) {
      console.error("Error adding member to channel:", error);
    }
  };

  const removeMemberFromChannel = async (channelId: string, userId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE_URL}/channels/${channelId}/members/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Refresh channel data
      if (selectedChannel && selectedChannel.id === channelId) {
        const updatedChannel = { ...selectedChannel };
        
        if (updatedChannel.members) {
          updatedChannel.members = updatedChannel.members.filter(m => m.id !== userId);
          setSelectedChannel(updatedChannel);
        }
      }
      
      // Refresh channels list
      fetchChannels();
    } catch (error) {
      console.error("Error removing member from channel:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const token = localStorage.getItem("token");
      let data: any = { content: newMessage };

      // Determine message type and recipient
      if (selectedChannel) {
        data.type = "channel";
        data.channelId = selectedChannel.id;
      } else if (selectedUser) {
        data.type = "private";
        data.receiverId = selectedUser.id;
      } else {
        data.type = "public";
      }

      const response = await axios.post(`${API_BASE_URL}/messages`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.data) {
        const sentMessage = response.data.data;
        
        // Update the appropriate message list
        if (selectedChannel) {
          setChannelMessages([...channelMessages, sentMessage]);
        } else if (selectedUser) {
          setMessages([...messages, sentMessage]);
        } else {
          setPublicMessages([...publicMessages, sentMessage]);
        }
      }

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const updateMessage = async (messageId: string) => {
    if (!editMessageContent.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${API_BASE_URL}/messages/${messageId}`,
        { content: editMessageContent },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data && response.data.data) {
        const updatedMessage = response.data.data;
        
        // Update the appropriate message list
        if (updatedMessage.type === "channel") {
          setChannelMessages(prev => 
            prev.map(msg => msg.id === messageId ? updatedMessage : msg)
          );
        } else if (updatedMessage.type === "private") {
          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? updatedMessage : msg)
          );
        } else {
          setPublicMessages(prev => 
            prev.map(msg => msg.id === messageId ? updatedMessage : msg)
          );
        }
      }

      setEditingMessage(null);
      setEditMessageContent("");
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Remove from all message lists
      setPublicMessages(prev => prev.filter(msg => msg.id !== messageId));
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setChannelMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Format timestamp for notifications
  const formatNotificationTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // More than a day
    const days = Math.floor(diff / 86400000);
    if (days === 1) {
      return 'Yesterday';
    }
    
    // Format date
    return date.toLocaleDateString();
  };

  // UI Components
  const renderAuthForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <h1>ParkhyaConnect</h1>
        <div className="backend-status">{backendStatus}</div>
      </div>

      {authError && <div className="auth-error">{authError}</div>}

      {isRegistering ? (
        <form onSubmit={handleRegister} className="auth-form">
          <h2>Register</h2>

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Mobile Number</label>
            <input
              type="text"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>

          <p className="auth-switch">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className="switch-button"
            >
              Login
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="auth-form">
          <h2>Login</h2>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="auth-switch">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className="switch-button"
            >
              Register
            </button>
          </p>
        </form>
      )}
    </div>
  );

  const renderWorkspace = () => (
    <div className="workspace">
      <div className="sidebar">
        <div className="workspace-header">
          <h2>ParkhyaConnect</h2>
          <div className="user-info">
            <div className="user-avatar sm">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.fullName || currentUser.email} />
              ) : (
                <div className="default-avatar">
                  {(currentUser?.fullName || currentUser?.email || "").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span>{currentUser?.fullName || currentUser?.email}</span>
            <span className="connection-status">{connectionStatus}</span>
          </div>
        </div>

        <div className="sidebar-sections">
          <div className="sidebar-section">
            <h3>Workspace</h3>
            <ul>
              <li
                className={activeSection === "messages" && !selectedUser && !selectedChannel ? "active" : ""}
                onClick={() => {
                  setActiveSection("messages");
                  setSelectedUser(null);
                  setSelectedChannel(null);
                  fetchPublicMessages();
                }}
              >
                <Hash size={18} />
                <span>Public Messages</span>
              </li>
              <li
                className={activeSection === "users" ? "active" : ""}
                onClick={() => {
                  setActiveSection("users");
                  setSelectedUser(null);
                  setSelectedChannel(null);
                  fetchUsers();
                }}
              >
                <Users size={18} />
                <span>All Users</span>
              </li>
            </ul>
          </div>

          <div className="sidebar-section">
            <div className="section-header-with-action">
              <h3>Channels</h3>
              <button 
                className="action-button"
                onClick={() => setShowCreateChannel(true)}
                title="Create Channel"
              >
                <Plus size={16} />
              </button>
            </div>
            <ul>
              {channels.map(channel => (
                <li
                  key={channel.id}
                  className={selectedChannel?.id === channel.id ? "active" : ""}
                  onClick={() => {
                    setSelectedChannel(channel);
                    setSelectedUser(null);
                    setActiveSection("messages");
                    fetchChannelMessages(channel.id);
                  }}
                >
                  <Hash size={18} />
                  <span>{channel.name}</span>
                  {channel.isPrivate && <span className="private-indicator">🔒</span>}
                </li>
              ))}
              {channels.length === 0 && (
                <li className="empty-list">No channels yet</li>
              )}
            </ul>
          </div>

          <div className="sidebar-section">
            <h3>Direct Messages</h3>
            <ul>
              {users.map(user => (
                <li
                  key={user.id}
                  className={selectedUser?.id === user.id ? "active" : ""}
                  onClick={() => {
                    setSelectedUser(user);
                    setSelectedChannel(null);
                    setActiveSection("messages");
                    fetchDirectMessages(user.id);
                  }}
                >
                  <div className="user-avatar sm">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.fullName || user.email} />
                    ) : (
                      <div className="default-avatar">
                        {(user.fullName || user.email || "").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span>{user.fullName || user.email}</span>
                  <span className={`status-indicator ${user.status === "active" ? "online" : "offline"}`}></span>
                </li>
              ))}
              {users.length === 0 && (
                <li className="empty-list">No users available</li>
              )}
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <div className="notification-icon" onClick={() => {
            setShowNotifications(!showNotifications);
            if (!showNotifications) {
              markAllNotificationsAsRead();
            }
          }}>
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span className="notification-badge">{unreadNotifications}</span>
            )}
          </div>
        </div>
        
        {showNotifications && (
          <div className="notifications-panel">
            <div className="notifications-header">
              <h3>Notifications</h3>
              <button className="close-button" onClick={() => setShowNotifications(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="notifications-list">
              {notifications.length === 0 ? (
                <div className="no-notifications">No notifications yet</div>
              ) : (
                notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${notification.read ? '' : 'unread'}`}
                    onClick={() => {
                      // Handle click on notification
                      if (notification.channelId) {
                        const channel = channels.find(c => c.id === notification.channelId);
                        if (channel) {
                          setSelectedChannel(channel);
                          setSelectedUser(null);
                          setActiveSection("messages");
                          fetchChannelMessages(notification.channelId);
                        }
                      } else if (notification.senderId) {
                        const user = users.find(u => u.id === notification.senderId);
                        if (user) {
                          setSelectedUser(user);
                          setSelectedChannel(null);
                          setActiveSection("messages");
                          fetchDirectMessages(notification.senderId);
                        }
                      }
                      
                      // Mark this notification as read
                      setNotifications(prev => 
                        prev.map(n => n.id === notification.id ? {...n, read: true} : n)
                      );
                      
                      setShowNotifications(false);
                    }}
                  >
                    <div className="notification-content">
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-time">{formatNotificationTime(notification.timestamp)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSection === "messages" && (
          <div className="messages-section">
            <div className="messages-header">
              {selectedChannel ? (
                <div className="channel-header">
                  <div className="channel-info">
                    <Hash size={20} />
                    <h3>{selectedChannel.name}</h3>
                    {selectedChannel.isPrivate && <span className="private-indicator">🔒</span>}
                  </div>
                  <div className="channel-actions">
                    <button 
                      className="channel-action-button"
                      onClick={() => setShowAddMember(true)}
                      title="Add Members"
                    >
                      <UserPlus size={18} />
                    </button>
                    {selectedChannel.createdBy === currentUser?.id && (
                      <button 
                        className="channel-action-button delete-channel"
                        onClick={() => setShowDeleteChannelConfirm(true)}
                        title="Delete Channel"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <span className="member-count">
                      {selectedChannel.members?.length || 0} members
                    </span>
                  </div>
                </div>
              ) : selectedUser ? (
                <div className="user-header">
                  <div className="user-avatar sm">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.fullName || selectedUser.email} />
                    ) : (
                      <div className="default-avatar">
                        {(selectedUser.fullName || selectedUser.email || "").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3>{selectedUser.fullName || selectedUser.email}</h3>
                  <span className={`status-indicator ${selectedUser.status === "active" ? "online" : "offline"}`}></span>
                </div>
              ) : (
                <div className="public-header">
                  <Hash size={20} />
                  <h3>Public Messages</h3>
                </div>
              )}
            </div>

            <div className="messages-container">
              {(selectedChannel ? channelMessages : selectedUser ? messages : publicMessages).length === 0 ? (
                <div className="no-messages">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                (selectedChannel ? channelMessages : selectedUser ? messages : publicMessages).map(message => {
                  const isCurrentUser = message.senderId === currentUser?.id;
                  const sender = users.find(u => u.id === message.senderId) || message.sender;
                  const senderName = sender?.fullName || sender?.email || "Unknown User";
                  const senderInitial = (senderName.charAt(0) || "?").toUpperCase();
                  const isEditing = editingMessage === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`message ${isCurrentUser ? "sent" : "received"}`}
                    >
                      <div className="message-sender">
                        <div className="user-avatar xs">
                          {sender?.avatar ? (
                            <img src={sender.avatar} alt={senderName} />
                          ) : (
                            <div className="default-avatar">
                              {senderInitial}
                            </div>
                          )}
                        </div>
                        <span>{senderName}</span>
                        <span className="message-time">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {isEditing ? (
                         <div className="edit-message-form">
                          <input
                            type="text"
                            value={editMessageContent}
                            onChange={(e) => setEditMessageContent(e.target.value)}
                            autoFocus
                          />
                          <div className="edit-actions">
                            <button onClick={() => updateMessage(message.id)}>Save</button>
                            <button onClick={() => {
                              setEditingMessage(null);
                              setEditMessageContent("");
                            }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="message-content">{message.content}</div>
                      )}
                      
                      {isCurrentUser && !isEditing && (
                        <div className="message-actions">
                          <button 
                            className="message-action-button"
                            onClick={() => {
                              setEditingMessage(message.id);
                              setEditMessageContent(message.content);
                            }}
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="message-action-button"
                            onClick={() => deleteMessage(message.id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message ${selectedChannel ? '#' + selectedChannel.name : selectedUser ? selectedUser.fullName || selectedUser.email : 'everyone'}`}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage} disabled={!newMessage.trim()}>Send</button>
            </div>
          </div>
        )}

        {activeSection === "users" && (
          <div className="users-section">
            <div className="section-header">
              <h3>Users</h3>
              <button onClick={fetchUsers} className="refresh-button">
                Refresh Users
              </button>
            </div>

            <div className="users-list">
              {users.length === 0 ? (
                <div className="no-users">No users found.</div>
              ) : (
                users.map(user => (
                  <div key={user.id} className="user-card">
                    <div className="user-card-header">
                      <div className="user-avatar md">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.fullName || user.email} />
                        ) : (
                          <div className="default-avatar">
                            {(user.fullName || user.email || "").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <h4>{user.fullName || "No Name"}</h4>
                        <p>{user.email}</p>
                        {user.mobileNumber && <p>Phone: {user.mobileNumber}</p>}
                      </div>
                    </div>

                    <div className="user-card-actions">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setSelectedChannel(null);
                          setActiveSection("messages");
                          fetchDirectMessages(user.id);
                        }}
                      >
                        Send Message
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Channel</h3>
              <button className="close-button" onClick={() => setShowCreateChannel(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. marketing"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="What's this channel about?"
                />
              </div>
              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  id="private-channel"
                  checked={isChannelPrivate}
                  onChange={(e) => setIsChannelPrivate(e.target.checked)}
                />
                <label htmlFor="private-channel">Make private</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setShowCreateChannel(false)}>
                Cancel
              </button>
              <button 
                className="primary-button" 
                onClick={createChannel}
                disabled={!newChannelName.trim()}
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && selectedChannel && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Manage Channel Members</h3>
              <button className="close-button" onClick={() => setShowAddMember(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <h4>Current Members</h4>
              <div className="members-list">
                {selectedChannel.members && selectedChannel.members.length > 0 ? (
                  selectedChannel.members.map(member => (
                    <div key={member.id} className="member-item">
                      <div className="user-avatar xs">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.fullName || member.email} />
                        ) : (
                          <div className="default-avatar">
                            {(member.fullName || member.email || "").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span>{member.fullName || member.email}</span>
                      {member.id !== currentUser?.id && (
                        <button 
                          className="remove-member-button"
                          onClick={() => removeMemberFromChannel(selectedChannel.id, member.id)}
                          title="Remove from channel"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p>No members in this channel yet.</p>
                )}
              </div>
              
              <h4>Add Members</h4>
              <div className="add-members-section">
                {users
                  .filter(user => !selectedChannel.members?.some(member => member.id === user.id))
                  .map(user => (
                    <div key={user.id} className="user-item">
                      <div className="user-avatar xs">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.fullName || user.email} />
                        ) : (
                          <div className="default-avatar">
                            {(user.fullName || user.email || "").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span>{user.fullName || user.email}</span>
                      <button 
                        className="add-member-button"
                        onClick={() => addMemberToChannel(selectedChannel.id, user.id)}
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-button" onClick={() => setShowAddMember(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Channel Confirmation Modal */}
      {showDeleteChannelConfirm && selectedChannel && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Delete Channel</h3>
              <button className="close-button" onClick={() => setShowDeleteChannelConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="delete-confirmation-message">
                Are you sure you want to delete the channel <strong>#{selectedChannel.name}</strong>?
              </p>
              <p className="delete-warning">
                This action cannot be undone. All messages in this channel will be permanently deleted.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="secondary-button" 
                onClick={() => setShowDeleteChannelConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="danger-button" 
                onClick={deleteChannel}
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      {isLoggedIn ? renderWorkspace() : renderAuthForm()}
    </div>
  );
};

export default App;