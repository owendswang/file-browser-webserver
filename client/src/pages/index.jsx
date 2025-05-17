import React, { useEffect } from 'react';
import { useLocation, useNavigate } from "react-router";

const Index = () => {
  const location = useLocation();

  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      ...location,
      pathname: '/home',
    });
  }, [location.pathname]);

  return null;
};

export default Index;