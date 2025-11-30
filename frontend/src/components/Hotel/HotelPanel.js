import React, { useEffect, useState, useMemo } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Chip,
  Stack,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Box,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { AddRounded, Inventory2Rounded, EmojiEvents, MapRounded } from '@mui/icons-material';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import PanelLayout from '../Layout/PanelLayout';
import StatCard from '../Common/StatCard';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const donationTypes = [
  { value: 'HUMAN', label: 'Human Consumption' },
  { value: 'DOG', label: 'Stray Dogs' },
  { value: 'COMPOST', label: 'Compost' },
];

const HotelPanel = ({ darkMode, setDarkMode }) => {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [points, setPoints] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
    foodName: '',
    description: '',
    quantity: '',
    expiryDate: '',
    donationType: 'HUMAN',
    address: '',
    latitude: '',
    longitude: '',
    photoUrl: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (user && user.userId) {
      refreshData();
    }
  }, [user]);

  const refreshData = () => {
    loadDonations();
    loadPoints();
  };

  const loadDonations = async () => {
    try {
      const response = await api.get(`/donations/donor/${user?.userId}`);
      setDonations(response.data || []);
    } catch (err) {
      console.error('Error loading donations:', err);
      const errorMessage = err.response?.data?.message || 'Unable to fetch donations.';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      setDonations([]);
    }
  };

  const loadPoints = async () => {
    try {
      const response = await api.get(`/gamification/points/${user?.userId}`);
      setPoints(response.data);
    } catch (err) {
      console.error('Error loading points:', err);
      // Don't show error for points, just leave it empty
      setPoints(null);
    }
  };

  const handleFormChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        enqueueSnackbar('Please select an image file', { variant: 'error' });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    
    // Verify user is authenticated
    if (!user || !user.token) {
      enqueueSnackbar('You must be logged in to upload images.', { variant: 'error' });
      return null;
    }
    
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      
      // Don't set Content-Type header - let axios/browser set it automatically with boundary
      // The interceptor will ensure Authorization header is included
      console.log('Uploading image with token:', user.token ? 'Present' : 'Missing');
      const response = await api.post('/files/upload', formData);
      
      return response.data.url;
    } catch (err) {
      console.error('Error uploading image:', err);
      console.error('Response status:', err.response?.status);
      console.error('Response data:', err.response?.data);
      
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to upload image. Please try again.';
      
      // Handle different error types
      if (err.response?.status === 401 || err.response?.status === 403) {
        enqueueSnackbar('Authentication failed. Your session may have expired. Please try logging in again.', { variant: 'error' });
      } else if (err.response?.status === 500) {
        enqueueSnackbar('Server error occurred. Please try again later.', { variant: 'error' });
      } else {
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
      
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateDonation = async (e) => {
    e.preventDefault();
    
    // Verify user is authenticated
    if (!user || !user.userId) {
      enqueueSnackbar('You must be logged in to create donations.', { variant: 'error' });
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      enqueueSnackbar('Your session has expired. Please log in again.', { variant: 'error' });
      return;
    }
    
    setSubmitting(true);
    try {
      // Upload image first if present
      let photoUrl = formData.photoUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) {
          setSubmitting(false);
          return;
        }
        // Ensure full URL is stored
        photoUrl = uploadedUrl.startsWith('http') ? uploadedUrl : `http://localhost:8080${uploadedUrl}`;
      }

      console.log('Creating donation with userId:', user.userId);
      console.log('Token present:', !!localStorage.getItem('token'));
      
      const donationData = {
        ...formData,
        photoUrl: photoUrl || null,
        quantity: parseInt(formData.quantity, 10),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };
      
      console.log('Donation data:', donationData);
      
      const response = await api.post(`/donations?donorId=${user.userId}`, donationData);
      console.log('Donation created successfully:', response.data);
      
      enqueueSnackbar('Donation published successfully!', { variant: 'success' });
      setFormData({
        foodName: '',
        description: '',
        quantity: '',
        expiryDate: '',
        donationType: 'HUMAN',
        address: '',
        latitude: '',
        longitude: '',
        photoUrl: '',
      });
      setImageFile(null);
      setImagePreview(null);
      setOpenForm(false);
      refreshData();
    } catch (err) {
      console.error('Error creating donation:', err);
      console.error('Response status:', err.response?.status);
      console.error('Response data:', err.response?.data);
      console.error('Request config:', err.config);
      
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Failed to publish donation. Please review the form.';
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        enqueueSnackbar('Authentication failed. Your session may have expired. Please log in again.', { variant: 'error' });
      } else {
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statItems = useMemo(
    () => [
      {
        label: 'Total donations',
        value: donations.length,
        icon: <Inventory2Rounded />,
        color: 'primary',
      },
      {
        label: 'Total points',
        value: points?.totalPoints ?? 0,
        icon: <EmojiEvents />,
        color: 'secondary',
      },
      {
        label: 'Level',
        value: points?.level ?? 1,
        icon: <MapRounded />,
        color: 'primary',
      },
    ],
    [donations.length, points]
  );

  const statusColor = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'EXPIRED':
      case 'REJECTED':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <PanelLayout
      title="Donor Command Center"
      subtitle="List surplus meals, track pickups, and grow your impact score."
      actions={
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => setOpenForm(true)}
        >
          Publish donation
        </Button>
      }
      darkMode={darkMode}
      setDarkMode={setDarkMode}
    >
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {statItems.map((item) => (
          <Grid item xs={12} md={4} key={item.label}>
            <StatCard {...item} />
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <div>
            <Typography variant="h6">Donation history</Typography>
            <Typography variant="body2" color="text.secondary">
              Track fulfilment, expiries, and compost pickups.
            </Typography>
          </div>
          <Button size="small" onClick={refreshData}>
            Refresh
          </Button>
        </Stack>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell>Food</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {donations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" align="center" color="text.secondary">
                    No donations yet. Share your first batch today!
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {donations.map((donation) => (
              <TableRow key={donation.id}>
                <TableCell>
                  <Stack direction="row" spacing={2}>
                    {donation.photoUrl && (
                      <Box
                        component="img"
                        src={donation.photoUrl.startsWith('http') ? donation.photoUrl : `http://localhost:8080${donation.photoUrl}`}
                        alt={donation.foodName}
                        sx={{
                          width: 60,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 1,
                        }}
                      />
                    )}
                    <Box>
                      <Typography variant="subtitle2">{donation.foodName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {donation.description || '—'}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={donation.donationType} size="small" />
                </TableCell>
                <TableCell>{donation.quantity}</TableCell>
                <TableCell>{dayjs(donation.expiryDate).format('MMM DD, YYYY HH:mm')}</TableCell>
                <TableCell>
                  <Chip
                    label={donation.status}
                    size="small"
                    color={statusColor(donation.status)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="md" fullWidth>
        <DialogTitle>Publish new donation</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Food name"
              value={formData.foodName}
              onChange={handleFormChange('foodName')}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={handleFormChange('description')}
              multiline
              minRows={2}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Quantity (meals)"
                  type="number"
                  value={formData.quantity}
                  onChange={handleFormChange('quantity')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Expiry date"
                  type="datetime-local"
                  value={formData.expiryDate}
                  onChange={handleFormChange('expiryDate')}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Donation type"
                  value={formData.donationType}
                  onChange={handleFormChange('donationType')}
                  fullWidth
                >
                  {donationTypes.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <TextField
              label="Pickup address"
              value={formData.address}
              onChange={handleFormChange('address')}
              multiline
              minRows={2}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Latitude"
                  type="number"
                  value={formData.latitude}
                  onChange={handleFormChange('latitude')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Longitude"
                  type="number"
                  value={formData.longitude}
                  onChange={handleFormChange('longitude')}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Food Image"
              type="file"
              inputProps={{ accept: 'image/*' }}
              onChange={handleImageChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            {imagePreview && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenForm(false)} color="inherit">
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            loading={submitting}
            onClick={handleCreateDonation}
          >
            Publish donation
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </PanelLayout>
  );
};

export default HotelPanel;

