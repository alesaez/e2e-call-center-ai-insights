import React, { useState } from 'react';
import {
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';

interface UserMenuProps {
  userInitials: string;
  userName: string;
  userEmail: string;
}

export default function UserMenu({ userInitials, userName, userEmail }: UserMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSettings = () => {
    navigate('/settings');
    handleClose();
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      account: accounts[0],
    });
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{ 
          ml: 2,
          p: 0.5,
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: 600,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.3)',
              transform: 'scale(1.05)',
            },
          }}
        >
          {userInitials}
        </Avatar>
      </IconButton>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 8,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.15))',
            mt: 1.5,
            minWidth: 280,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
              border: '1px solid',
              borderColor: 'divider',
              borderRight: 'none',
              borderBottom: 'none',
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info Section */}
        <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 48,
                height: 48,
                fontSize: '1.1rem',
                mr: 2,
                boxShadow: 2,
              }}
            >
              {userInitials}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ mb: 0.5 }}>
                {userName}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {userEmail}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Settings Option */}
        <MenuItem 
          onClick={handleSettings}
          sx={{
            mx: 1,
            mb: 0.5,
            borderRadius: 1,
            '&:hover': {
              bgcolor: 'grey.100',
            },
          }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Sign Out Option */}
        <MenuItem
          onClick={handleLogout}
          sx={{
            mx: 1,
            mb: 1,
            borderRadius: 1,
            color: 'error.main',
            '&:hover': {
              bgcolor: 'grey.100',
            },
          }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sign Out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}