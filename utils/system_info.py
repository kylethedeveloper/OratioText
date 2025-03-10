import psutil
import torch

class SystemInfo:
    @staticmethod
    def get_system_specs():
        """Get system specifications."""
        return {
            'cpu_count': psutil.cpu_count(logical=False),
            'total_memory': psutil.virtual_memory().total / (1024 ** 3),  # GB
            'gpu_available': torch.cuda.is_available(),
            'gpu_name': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            'gpu_memory': torch.cuda.get_device_properties(0).total_memory / (1024**3) if torch.cuda.is_available() else 0
        }

    @staticmethod
    def recommend_model(specs):
        """Recommend a Whisper model based on system specifications."""
        if specs['gpu_available'] and specs['gpu_memory'] >= 10:
            return 'large', 'Your system has sufficient GPU resources for the large model.'
        elif specs['gpu_available'] and specs['gpu_memory'] >= 5:
            return 'medium', 'Based on your GPU resources, the medium model is recommended.'
        elif specs['total_memory'] >= 8 and specs['cpu_count'] >= 4:
            return 'small', 'Based on your CPU and memory, the small model is recommended.'
        elif specs['total_memory'] >= 4:
            return 'base', 'Based on your system resources, the base model is recommended.'
        else:
            return 'tiny', 'The tiny model is recommended for your system specifications.'

    @staticmethod
    def get_recommended_model():
        """Get the recommended model based on current system specs."""
        specs = SystemInfo.get_system_specs()
        return SystemInfo.recommend_model(specs)
